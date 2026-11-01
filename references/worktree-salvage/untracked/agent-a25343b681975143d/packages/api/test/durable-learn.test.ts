// Durable `/learn/*` learner state (Phase 4). The claims under test are the ones that cannot be inspected,
// only PROVEN by killing something:
//   RESTART   — answers written over HTTP survive a full app teardown; a NEW app over the SAME ZSM_DATA_DIR
//               reproduces the identical folded mastery. This is the property the in-memory Map cannot have.
//   PARITY    — durable and ephemeral report the SAME mastery for the same answer sequence (so switching the
//               env cannot silently change a learner's numbers).
//   SHRED     — crypto-shredding a learner makes their state unrecoverable (410), leaves other learners
//               untouched, and does NOT disturb the anonymous population statistics (DR-10/27).
//   ENV       — no ZSM_MASTER_KEK ⇒ ephemeral + a LOUD boot line; a malformed key ⇒ boot FAILS (never a
//               silent downgrade, never a default key).
//   CONCURRENCY — simultaneous answers for one learner are ALL recorded. (Proved RED first: without the
//               per-learner write serialization, 10 concurrent answers persisted exactly 1 event.)
//   SCAFFOLD  — the served scaffold rides the persisted event, so a reload folds to the same mastery.

import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, createAppFromEnv, type AppInstance } from "../src/app.js";
import {
  createDurableLearnStore,
  DEFAULT_COHORT_CELL,
  type DurableLearnStoreHandle,
} from "../src/durable-learn-store.js";
import {
  resolveLearnPersistence,
  parseMasterKek,
  durableBootLine,
  DEFAULT_DATA_DIR,
  EPHEMERAL_BOOT_LINE,
  IN_MEMORY_DATA_DIR,
  MASTER_KEK_ENV,
  DATA_DIR_ENV,
} from "../src/learn-persistence.js";
import { getCurriculum, getDemoConfusability } from "../src/curriculum-source.js";

/** A deterministic 32-byte KEK for tests. In production this comes from the env / a KMS, never from source. */
const KEK_HEX = "1".repeat(64);
const KEK = Buffer.from(KEK_HEX, "hex");

/**
 * PGlite boots a real Postgres in WASM; a FILE-BACKED one also runs initdb against the data dir. That is tens
 * of seconds on a loaded box — far past vitest's 5s default. A generous bound keeps the durability proof from
 * degenerating into a timing flake, while still failing if something genuinely hangs.
 */
const PGLITE_TIMEOUT_MS = 180_000;

type Json = Record<string, any>;

const tempDirs: string[] = [];
const openHandles: DurableLearnStoreHandle[] = [];
const openApps: AppInstance[] = [];

// Close every PGlite instance BEFORE removing its data dir — deleting the directory under a live instance
// makes it fault (ENOENT) asynchronously, which surfaces as an unhandled rejection rather than a test failure.
afterEach(async () => {
  for (const a of openApps.splice(0)) await a.close();
  for (const h of openHandles.splice(0)) await h.close();
  for (const d of tempDirs.splice(0)) await rm(d, { recursive: true, force: true });
}, PGLITE_TIMEOUT_MS);

const newDataDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "zsm-durable-"));
  tempDirs.push(dir);
  return dir;
};

type BootedApp = AppInstance & { readonly lines: string[] };

/** Boot an app from an explicit env object, capturing the boot lines instead of printing them. */
const boot = async (env: Record<string, string | undefined>): Promise<BootedApp> => {
  const lines: string[] = [];
  const instance = await createAppFromEnv(env, DEFAULT_DATA_DIR, (l) => lines.push(l));
  const booted: BootedApp = { ...instance, lines };
  openApps.push(booted);
  return booted;
};

/** Tear an app down NOW (the restart proof depends on the first instance being genuinely gone). */
const shutdown = async (booted: BootedApp): Promise<void> => {
  const at = openApps.indexOf(booted);
  if (at >= 0) openApps.splice(at, 1);
  await booted.close();
};

type Answerer = (learner: string) => Promise<Json>;

/** Drive ONE next→answer step over HTTP: ask for the adaptive step, answer its first item correctly. */
const stepFor = (app: { request: (path: string, init?: RequestInit) => Promise<Response> }): Answerer => {
  return async (learner: string) => {
    const next = (await (await app.request(`/learn/next?learner=${learner}`)).json()) as Json;
    expect(next.success, JSON.stringify(next)).toBe(true);
    const itemId = next.data.items[0]?.itemId;
    expect(itemId, `no item served for target KC ${next.data.targetKc}`).toBeTruthy();
    const res = await app.request("/learn/answer", {
      method: "POST",
      body: JSON.stringify({ learner, item_id: itemId, correct: true }),
      headers: { "content-type": "application/json" },
    });
    const json = (await res.json()) as Json;
    expect(json.success, JSON.stringify(json)).toBe(true);
    return json;
  };
};

const stateOf = async (
  app: { request: (path: string, init?: RequestInit) => Promise<Response> },
  learner: string,
): Promise<Json> => (await (await app.request(`/learn/state?learner=${learner}`)).json()) as Json;

/** The mastery projection, order-normalised — the thing a restart must reproduce EXACTLY. */
const masteryOf = (state: Json): unknown =>
  [...state.data.mastery].sort((a: Json, b: Json) => (a.kcId < b.kcId ? -1 : 1));

describe("@zsm/api · durable /learn state (PGlite + crypto-shred + RLS)", () => {
  it("RESTART — answers written over HTTP survive teardown: a NEW app over the same ZSM_DATA_DIR reproduces the mastery", async () => {
    const dataDir = await newDataDir();
    const env = { [MASTER_KEK_ENV]: KEK_HEX, [DATA_DIR_ENV]: dataDir };
    const learner = "agent.restart";

    const first = await boot(env);
    expect(first.mode).toBe("durable");
    expect(first.dataDir).toBe(dataDir);
    expect(first.lines).toContain(durableBootLine(dataDir));

    const answer = stepFor(first.app);
    for (let i = 0; i < 6; i++) await answer(learner);
    const before = await stateOf(first.app, learner);
    expect(before.data.eventsRecorded).toBe(6);
    expect(before.data.touchedKcs).toBeGreaterThan(0);

    // The bytes really are on disk (not an in-memory PGlite that merely accepted a path).
    expect((await readdir(dataDir)).length).toBeGreaterThan(0);

    // TEAR THE APP DOWN — the PGlite instance is released; nothing of this process's state remains.
    await shutdown(first);

    // A COMPLETELY NEW app over the same data dir.
    const second = await boot(env);
    const after = await stateOf(second.app, learner);

    expect(after.data.eventsRecorded).toBe(6);
    expect(masteryOf(after)).toEqual(masteryOf(before));
    expect(after.data.masteredCount).toBe(before.data.masteredCount);
    expect(after.data.touchedKcs).toBe(before.data.touchedKcs);

    // And the restarted server keeps APPENDING to the same log rather than restarting the sequence — the
    // failure this guards is a fresh per-process ingestSeq re-minting event ids that the (learner, event_id)
    // dedupe then silently swallows, so post-restart answers would vanish.
    const seventh = await stepFor(second.app)(learner); // the NEW app's stepper — the old app is closed
    expect(seventh.data.eventsRecorded).toBe(7);
    expect((await stateOf(second.app, learner)).data.eventsRecorded).toBe(7);
  }, PGLITE_TIMEOUT_MS);

  it("RESTART — an untouched learner is still untouched after a restart (no cross-learner bleed)", async () => {
    const dataDir = await newDataDir();
    const env = { [MASTER_KEK_ENV]: KEK_HEX, [DATA_DIR_ENV]: dataDir };

    const first = await boot(env);
    const answer = stepFor(first.app);
    for (let i = 0; i < 3; i++) await answer("agent.one");
    await shutdown(first);

    const second = await boot(env);
    expect((await stateOf(second.app, "agent.one")).data.eventsRecorded).toBe(3);
    const ghost = await stateOf(second.app, "agent.never-seen");
    expect(ghost.data.eventsRecorded).toBe(0);
    expect(ghost.data.mastery).toEqual([]);
  }, PGLITE_TIMEOUT_MS);

  it("PARITY — durable and ephemeral report the IDENTICAL mastery for the same answer sequence", async () => {
    // Same script, two persistence modes. If the durable path folded with different options (e.g. via
    // store.loadState, which drops `confusability`) or dropped the event's `scaffold`, these would diverge.
    const learner = "agent.parity";
    const ephemeral = createApp();
    const durable = await createDurableLearnStore({ kek: KEK, confusability: getDemoConfusability() });
    openHandles.push(durable);
    const durableApp = createApp({ learnStore: durable.store });

    const stepE = stepFor(ephemeral);
    const stepD = stepFor(durableApp);
    for (let i = 0; i < 8; i++) {
      await stepE(learner);
      await stepD(learner);
    }

    const e = await stateOf(ephemeral, learner);
    const d = await stateOf(durableApp, learner);
    expect(d.data.eventsRecorded).toBe(e.data.eventsRecorded);
    expect(masteryOf(d)).toEqual(masteryOf(e));
  }, PGLITE_TIMEOUT_MS);

  it("SHRED — an erased learner is 410 on every /learn route, other learners are untouched", async () => {
    const durable = await createDurableLearnStore({ kek: KEK, confusability: getDemoConfusability() });
    openHandles.push(durable);
    const app = createApp({ learnStore: durable.store });
    const answer = stepFor(app);

    for (let i = 0; i < 4; i++) await answer("agent.shredded");
    for (let i = 0; i < 2; i++) await answer("agent.bystander");
    expect((await stateOf(app, "agent.shredded")).data.eventsRecorded).toBe(4);
    expect(await durable.isErased("agent.shredded")).toBe(false);

    await durable.erase("agent.shredded"); // admin-only: destroys the wrapped DEK (DR-25)

    expect(await durable.isErased("agent.shredded")).toBe(true);

    const state = await app.request("/learn/state?learner=agent.shredded");
    expect(state.status).toBe(410);
    expect((await state.json()).error).toMatch(/erased/);

    const next = await app.request("/learn/next?learner=agent.shredded");
    expect(next.status).toBe(410);

    const write = await app.request("/learn/answer", {
      method: "POST",
      body: JSON.stringify({ learner: "agent.shredded", item_id: getCurriculum().items[0]!.item_id, correct: true }),
      headers: { "content-type": "application/json" },
    });
    expect(write.status).toBe(410);

    // The bystander is completely unaffected by another learner's erasure.
    const bystander = await stateOf(app, "agent.bystander");
    expect(bystander.data.eventsRecorded).toBe(2);
    expect(bystander.data.touchedKcs).toBeGreaterThan(0);
  }, PGLITE_TIMEOUT_MS);

  it("SHRED — the ANONYMOUS population statistics survive the erasure unchanged (DR-10/27)", async () => {
    const durable = await createDurableLearnStore({ kek: KEK, confusability: getDemoConfusability() });
    openHandles.push(durable);

    // Drive the store directly so every answer lands on ONE KC: the k-anon floor (5) suppresses smaller cells,
    // and a suppressed-before/suppressed-after comparison would prove nothing.
    const kc = getCurriculum().items[0]!.kc_id;
    for (let i = 0; i < 6; i++) await durable.store.recordAnswer("agent.pop", kc, i % 2 === 0);

    const before = await durable.populationStats.readCell(DEFAULT_COHORT_CELL, kc);
    expect(before).not.toBeNull(); // above the k-anon floor, so this is a real reading
    expect(before!.attempts).toBe(6);
    expect(before!.corrects).toBe(3);

    await durable.erase("agent.pop");

    // The learner is gone...
    await expect(durable.store.stateFor("agent.pop")).rejects.toThrow(/erased/);
    // ...but the population cell is untouched: those rows never carried a learner_ref to shred.
    const after = await durable.populationStats.readCell(DEFAULT_COHORT_CELL, kc);
    expect(after).toEqual(before);
  }, PGLITE_TIMEOUT_MS);

  it("ENV — no ZSM_MASTER_KEK ⇒ ephemeral, a LOUD boot line, and no data dir touched", async () => {
    // Compared before/after rather than asserted absolute: a durable boot smoke may legitimately have left a
    // `.zsm-data/` in the repo. What must hold is that THIS boot creates nothing.
    const dataDirBefore = existsSync(DEFAULT_DATA_DIR);
    const instance = await boot({});
    expect(instance.mode).toBe("ephemeral");
    expect(instance.dataDir).toBeNull();
    expect(instance.durable).toBeNull();
    expect(instance.lines).toEqual([EPHEMERAL_BOOT_LINE]);
    expect(instance.lines[0]).toContain("EPHEMERAL");
    expect(instance.lines[0]).toContain(MASTER_KEK_ENV);
    // The ephemeral default must not create the durable data dir as a side effect.
    expect(existsSync(DEFAULT_DATA_DIR)).toBe(dataDirBefore);

    // ...and the loop still works exactly as before.
    const answer = stepFor(instance.app);
    await answer("agent.ephemeral");
    expect((await stateOf(instance.app, "agent.ephemeral")).data.eventsRecorded).toBe(1);
  }, PGLITE_TIMEOUT_MS);

  it("ENV — a malformed ZSM_MASTER_KEK FAILS the boot; it is never downgraded to ephemeral", async () => {
    await expect(createAppFromEnv({ [MASTER_KEK_ENV]: "not-a-key" }, DEFAULT_DATA_DIR, () => {})).rejects.toThrow(
      /must be 32 bytes/,
    );
    // A 16-byte key is not "close enough" either — no padding, no stretching, no derivation.
    expect(() => parseMasterKek(Buffer.alloc(16, 3).toString("base64"))).toThrow(/must be 32 bytes/);
    // A hex key of the wrong length falls through to the base64 branch and is still rejected.
    expect(() => parseMasterKek("abcdef")).toThrow(/must be 32 bytes/);
  });

  it("ENV — the persistence posture is COMPUTED from the env, with an in-memory library default", () => {
    expect(resolveLearnPersistence({})).toEqual({ mode: "ephemeral" });
    // An empty value reads as "not configured" (shell/compose semantics) — and is still announced at boot.
    expect(resolveLearnPersistence({ [MASTER_KEK_ENV]: "   " })).toEqual({ mode: "ephemeral" });

    const lib = resolveLearnPersistence({ [MASTER_KEK_ENV]: KEK_HEX });
    expect(lib.mode).toBe("durable");
    if (lib.mode === "durable") {
      expect(lib.dataDir).toBe(IN_MEMORY_DATA_DIR); // hermetic by default: no disk unless asked
      expect(lib.kek.equals(KEK)).toBe(true);
    }

    const server = resolveLearnPersistence({ [MASTER_KEK_ENV]: KEK_HEX }, DEFAULT_DATA_DIR);
    expect(server.mode === "durable" && server.dataDir).toBe(DEFAULT_DATA_DIR);

    const explicit = resolveLearnPersistence({ [MASTER_KEK_ENV]: KEK_HEX, [DATA_DIR_ENV]: "/tmp/zsm-x" });
    expect(explicit.mode === "durable" && explicit.dataDir).toBe("/tmp/zsm-x");

    // base64 is accepted as well as hex, and both spellings of the same key produce the same bytes.
    const b64 = resolveLearnPersistence({ [MASTER_KEK_ENV]: KEK.toString("base64") });
    expect(b64.mode === "durable" && b64.kek.equals(KEK)).toBe(true);
  }, PGLITE_TIMEOUT_MS);

  it("CONCURRENCY — simultaneous answers for one learner are all recorded (none swallowed by the dedupe)", async () => {
    // recordAnswer reads the log, then appends across an await. Without per-learner serialization, concurrent
    // POSTs would mint the SAME event id and `onConflictDoNothing` would drop all but one — a 200 for an answer
    // that was never stored. Ten at once, all on the same learner.
    const durable = await createDurableLearnStore({ kek: KEK, confusability: getDemoConfusability() });
    openHandles.push(durable);
    const kc = getCurriculum().items[0]!.kc_id;

    const counts = await Promise.all(
      Array.from({ length: 10 }, () => durable.store.recordAnswer("agent.race", kc, true)),
    );

    const events = await durable.store.eventsFor("agent.race");
    expect(events.length).toBe(10);
    expect(new Set(events.map((e) => e.eventId)).size).toBe(10);
    expect(events.map((e) => e.ingestSeq).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Every caller saw a distinct running total — the count is not a guess either.
    expect([...counts].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  }, PGLITE_TIMEOUT_MS);

  it("SCAFFOLD — the scaffold served with a step is PERSISTED on the event and survives a reload", async () => {
    // The fold's expertise-reversal channel rides `scaffold`, which the store used to drop on persist. If it
    // were dropped, a reloaded log would fold to different mastery than the live one — silently.
    const durable = await createDurableLearnStore({ kek: KEK, confusability: getDemoConfusability() });
    openHandles.push(durable);
    const app = createApp({ learnStore: durable.store });
    const answer = stepFor(app);
    for (let i = 0; i < 3; i++) await answer("agent.scaffold");

    const events = await durable.store.eventsFor("agent.scaffold");
    expect(events.length).toBe(3);
    expect(events.every((e) => e.scaffold !== undefined)).toBe(true);
    expect(events.map((e) => e.ingestSeq)).toEqual([1, 2, 3]);
    expect(events.map((e) => e.latticeEpoch)).toEqual([1, 2, 3]);
  }, PGLITE_TIMEOUT_MS);
});
