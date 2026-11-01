# BUILD-RECEIPT — durable-learn-store (master plan Phase 4)

Lane: `wip/pk33/durable-learn-store` (isolated worktree)
Base snapshot: `b45139e` (worktree HEAD). `origin/main` at fetch time: `ec52477`
(resolver-crossfix-w7) — NOT merged in; this lane builds on its own snapshot per the lane brief.
Footprint: `packages/api/` + `packages/store/` + `_lanes/` (`packages/serving/` untouched — see
§1.1 seam justification). `packages/api/src/strand-source.ts` (another lane's `latticeError` flag)
NOT touched.

Realizes: durable-learn-store

---

## 1. DESIGN NOTE (written before the implementation)

### 1.0 The problem

`/learn/*` learner state lives in `packages/api/src/learn-store.ts` — a `Map<learner, LearnerEvent[]>`
that dies with the process. The durable layer (`@zsm/store`: PGlite in-process WASM Postgres,
append-only `learner_event`, per-learner DEK crypto-shred, FORCE-RLS, drizzle) exists and is tested,
but nothing imports it outside its own package.

### 1.1 Seam: the adapter lives in `packages/api`, not `packages/serving`

`packages/serving` DOES already depend on `@zsm/store` — `serveLearner.ts` takes a `ServingEventStore`
+ `PopulationStats`, so "serving owns the durable seam" was a live option and was considered. It was
rejected because that seam is a **different loop**:

- `serveLearner` decides via `serveNext` + a consent/ownership gate; `/learn/*` decides via
  `decideAdaptive` and has no consent surface wired.
- `serveLearner` folds via `store.loadState(...)`, which passes **no `FoldOptions`** — no
  `confusability`. The `/learn` path folds WITH it.
- `serveLearner` has no notion of minting event ids/`ingestSeq`, no served-scaffold side-channel, and
  no demo learner-handle namespace.

Everything the `LearnStore` port needs is api-local:

- `DEMO_PARAM_VERSION` (the fold parameter the routes thread) — `packages/api/src/learn-store.ts`
- the `ConfusabilityMap` built from `getCurriculum().realizationEdges` — `packages/api/src/curriculum-source.ts`
- the served-scaffold side-channel (`noteServedScaffold` ← `/learn/next`'s D4 `scaffoldLevel`)
- the demo learner-handle namespace (`<learner>:ans:<seq>` event ids)

Putting the port in `packages/serving` would mean teaching the serving layer about demo handles and
the /learn adaptive controller, and would still leave the api layer owning the fold options. So:
**new file `packages/api/src/durable-learn-store.ts`**, `@zsm/store` added to `@zsm/api` deps.
`packages/serving` is left completely untouched — but the adapter deliberately MIRRORS
`recordResponse`'s append-then-accrue contract (DR-27) rather than inventing a different one.

### 1.2 Adapter mapping — the `LearnStore` contract onto `EventStore`

The in-memory contract is **synchronous**; `EventStore` is unavoidably async (SQL). One interface
must serve both, so `LearnStore` becomes **async for the log-touching methods** and both
implementations satisfy it. The **HTTP surface is unchanged** — the route handlers just `await`.

| `LearnStore` | ephemeral (`createLearnStore`) | durable (`createDurableLearnStore`) |
|---|---|---|
| `noteServedScaffold(l,kc,s)` → `void` | in-process `Map` | in-process `Map` (identical — see §1.5) |
| `servedScaffoldFor(l,kc)` → `Scaffolding?` | in-process `Map` | in-process `Map` |
| `recordAnswer(l,kc,correct)` → `Promise<number>` | push + return length | load log → `ingestSeq = max+1` → `eventStore.append([e], PV)` → accrue population stat → return count |
| `eventsFor(l)` → `Promise<readonly LearnerEvent[]>` | `Map.get` | `eventStore.loadEvents(l)` (decrypt, RLS-scoped) |
| `stateFor(l)` → `Promise<LearnerStateBundle>` | `fold(events, PV, true, {confusability})` | **same `fold` call over the loaded events** |
| `durable` → `boolean` | `false` | `true` |

Two deliberate choices:

1. **The adapter folds; it does NOT call `eventStore.loadState`.** `loadState` folds with
   `fold(events, pv, true)` — *no* `FoldOptions`, i.e. no `confusability`. Using it would silently
   drop the D2 inter-KC discrimination coupling that the ephemeral path applies, so durable mode
   would return *different mastery numbers* than ephemeral for the same answers. Folding in the
   adapter keeps **one fold call site with one set of options** for both modes; that equivalence is
   asserted by a test (`durable and ephemeral folds agree`).
2. **`ingestSeq` continues from the persisted log, never from a process-local counter.** The
   in-memory store counts from 0 per process. After a restart that would re-mint `l:ans:1`, and
   `append`'s `onConflictDoNothing` on `(learner_ref, event_id)` would **silently drop** every
   post-restart answer. So the durable `recordAnswer` derives `ingestSeq = max(persisted)+1`
   (`latticeEpoch = ingestSeq`, as in the ephemeral store).

### 1.3 Erasure is a first-class route outcome

`erase()` is admin-only and deliberately **not** on `LearnStore` (the store package makes the same
split: `ServingEventStore` has no `erase`). It is exposed on the *handle* returned by
`createDurableLearnStore`, not through HTTP — there is no erase route, and this lane does not add one.

A shredded learner has ciphertext rows and no DEK. `eventsFor`/`stateFor` then throw
`LearnerErasedError`, and the `/learn/*` handlers translate it to **`410 Gone`** with the standard
`fail()` envelope. This status is unreachable in ephemeral mode and unreachable in durable mode
until an operator shreds, so no existing response changes.

### 1.4 KEK sourcing — `ZSM_MASTER_KEK`, never a silent default

- **absent** ⇒ ephemeral in-memory store + a LOUD boot line:
  `[@zsm/api] learner state EPHEMERAL — set ZSM_MASTER_KEK for durability`
- **present** ⇒ 32 bytes, accepted as 64-char hex or base64. Anything else (wrong length, junk)
  **throws at boot** — a malformed key is a configuration error, never a downgrade to ephemeral and
  never a derived/padded key. There is no default key constant anywhere in the tree.

The KEK is read once at app construction and handed to `makeEventStore` as a `Buffer`; it is never
logged, never persisted, and never defaulted (`@zsm/store/crypto` already asserts the 32-byte length
at its own boundary).

### 1.5 Persistence location — `ZSM_DATA_DIR`

- `ZSM_DATA_DIR` set ⇒ PGlite is file-backed at that path (a real directory that survives restarts).
- unset, in the **server boot** path ⇒ default `.zsm-data/` (gitignored).
- unset, in the **library** path (`createDurableLearnStore({ kek })` with no `dataDir`) ⇒
  **in-memory PGlite**, so tests stay hermetic and leave no droppings. `ZSM_DATA_DIR=:memory:` is
  also honoured explicitly.

Re-opening an existing data dir is safe: `SCHEMA_DDL` is all `CREATE TABLE IF NOT EXISTS` and
`enableRls` is idempotent (`CREATE ROLE` guarded, `DROP POLICY IF EXISTS` before `CREATE POLICY`).

**Accepted, documented loss on restart:** the *pending* served-scaffold map (a scaffold served by
`/learn/next` but not yet answered) is process-local in both modes. It is regenerated by the next
`/learn/next` call, and the scaffold that was actually *used* is persisted on the event itself
(§1.6). Nothing folded is lost.

### 1.6 Store-side fidelity fix (in footprint, required for restart equality)

`@zsm/store`'s encrypted payload carried `{latticeEpoch, verb, correct?}` only. `LearnerEvent`
also carries four OPTIONAL signal fields — `scaffold`, `metacognition`, `encoding`, `feedback` —
each of which changes the fold's learn-rate. `append()` accepted them and **silently dropped them**.
The `/learn` path really does emit `scaffold` (from the D4 decision), so without this fix a
post-restart fold would differ from the pre-restart fold — the exact property this lane must prove.

Fix: the payload now round-trips all four (encoded only when present, so a payload written before
this change decodes unchanged), `ENCRYPTED_CONTRACT_FIELDS` is widened to the full contract, and the
DR-24 conformance test's field list is widened with it (it now proves 1:1 conformance over all 11
`LearnerEvent` fields instead of 7). Values are validated against compile-time-exhaustive allow-lists
on decode.

Also fixed: `loadEvents` threw `learner X is erased (no DEK)` for a **never-existed** learner, which
`loadState` already distinguishes correctly. It now returns `[]` when there is no DEK *and* no
ciphertext, and throws a typed `LearnerErasedError` only for a genuinely shredded learner.

### 1.6b Concurrency: per-learner write serialization (a bug found while building, RED-proved)

`recordAnswer` reads the log, then appends — across an `await`. In the ephemeral store that sequence
never yields, so it is atomic by accident. In the durable store two concurrent `POST /learn/answer`
for the SAME learner both read seq *N*, both mint `<learner>:ans:N+1`, and `onConflictDoNothing`
swallows the loser: **a 200 for an answer that was never stored.**

Measured, by temporarily bypassing the fix: 10 concurrent `recordAnswer` calls persisted **1 event**.

Fixed with one promise chain per learner in the adapter (`serializeWrite`), which is sufficient
because a PGlite data dir is owned by a single process — in-process ordering IS global ordering here.
A multi-process deployment (real Postgres) would need the sequence minted inside the transaction; that
is a store-level change and is noted as debt, not silently assumed away.

### 1.7 Population stats survive the shred

`makePopulationStats` accrues anonymous-at-ingest rows (learner_ref stripped) into `population_stat`,
a table that is **not** learner-scoped and **not** crypto-shreddable. The durable adapter accrues
each answered event into a cohort cell (default `demo:<strand>`), so the "shred the learner,
population keeps its aggregate" contract is exercised end-to-end rather than asserted on paper.

### 1.8 Env contract (summary)

| var | unset | set |
|---|---|---|
| `ZSM_MASTER_KEK` | ephemeral store + loud boot line | 32-byte hex/base64 ⇒ durable; malformed ⇒ boot throws |
| `ZSM_DATA_DIR` | server boot: `.zsm-data/`; library: in-memory PGlite | PGlite data dir (`:memory:` honoured) |

---

## 2. WHAT WAS BUILT

### New files

| file | what |
|---|---|
| `packages/api/src/durable-learn-store.ts` | the durable `LearnStore` over `@zsm/store` (+ the admin-only `erase`/`isErased`/`populationStats`/`close` handle) |
| `packages/api/src/learn-persistence.ts` | the env contract: `parseMasterKek`, `resolveLearnPersistence`, `EPHEMERAL_BOOT_LINE`, `durableBootLine`, `DEFAULT_DATA_DIR` |
| `packages/api/test/durable-learn.test.ts` | 10 tests: RESTART ×2, PARITY, SHRED ×2, ENV ×3, CONCURRENCY, SCAFFOLD |
| `_lanes/durable-learn-store/BUILD-RECEIPT.md` | this receipt |
| `_lanes/durable-learn-store/durable-smoke.sh` | the re-runnable durable restart smoke (§4.2) |

### Changed files

| file | change |
|---|---|
| `packages/api/src/learn-store.ts` | `LearnStore` is now the PORT both stores implement: `recordAnswer`/`eventsFor`/`stateFor` are async, plus a `durable: boolean`. The in-memory implementation is otherwise byte-for-byte the same fold. |
| `packages/api/src/routes/learn.ts` | `makeLearnRoutes(store?)` takes the port (default = ephemeral); handlers `await`; `LearnerErasedError` → `410`. No response shape changed. |
| `packages/api/src/app.ts` | `createApp({ learnStore })` injection point + `createAppFromEnv()` — the ONE place that chooses durable vs ephemeral and prints the boot line. |
| `packages/api/src/server.ts` | `startServer` builds from the env and its `close()` also releases the durable store. |
| `packages/api/src/curriculum-source.ts` | `getDemoConfusability()` — the memoised relation both stores fold with (previously built inline in `makeLearnRoutes`). |
| `packages/api/src/index.ts` | exports the new surface. |
| `packages/api/package.json`, `packages/api/tsconfig.json` | `@zsm/store` dependency + project reference. |
| `packages/api/README.md` | the env contract + an ephemeral-vs-durable table. |
| `packages/store/src/db.ts` | `createDb({ dataDir })` — file-backed PGlite (absent/`:memory:` ⇒ unchanged in-memory behaviour). |
| `packages/store/src/eventStore.ts` | payload now round-trips `scaffold`/`metacognition`/`encoding`/`feedback` (§1.6); typed `LearnerErasedError`; `loadEvents` returns `[]` for a never-existed learner instead of claiming erasure. |
| `packages/store/src/schema.ts` | `ENCRYPTED_CONTRACT_FIELDS` widened to the full contract. |
| `packages/store/test/store.test.ts` | DR-24 conformance list widened to all 11 `LearnerEvent` fields. |
| `.gitignore` | `.zsm-data/` (see FLAG-3). |
| `pnpm-lock.yaml` | mechanical result of adding the `@zsm/store` workspace dep. |

---

## 3. ACCEPTANCE (verbatim)

### 3.1 `pnpm typecheck` — 0

```
$ pnpm typecheck

> zsm@0.0.0 typecheck /home/pk33/tzerp/zsm1-tzerp/.claude/worktrees/agent-a25343b681975143d
> tsc -b --pretty false
```

(no output, exit 0)

### 3.2 `pnpm test` — full suite

BASELINE, before any change (`b45139e`, same worktree):

```
 Test Files  100 passed (100)
      Tests  896 passed | 2 skipped (898)
   Start at  23:58:20
   Duration  846.48s (transform 16.63s, setup 0ms, collect 606.47s, tests 1020.37s, environment 73ms, prepare 30.05s)
```

AFTER, run 1 on the final tree (verbatim tail) — ONE failure, in an UNTOUCHED package:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  packages/queue/test/queue.test.ts > @zsm/queue · claim-ingestion plane (L-DD-17, live Redis) > routes a mixed firehose: reject at edge, defer, promote — never writes trunk
Error: Test timed out in 5000ms.

 Test Files  1 failed | 100 passed (101)
      Tests  1 failed | 905 passed | 2 skipped (908)
   Start at  00:38:08
   Duration  859.27s (transform 21.87s, setup 0ms, collect 792.26s, tests 1282.32s, environment 131ms, prepare 39.04s)
```

Diagnosed, not waved away (see FLAG-9): `packages/queue` is untouched by this lane, the test needs a
LIVE Redis, and it is a 5s-default-timeout test that takes ~4.8s when it passes. Re-run in isolation
on the SAME final tree, immediately after:

```
 ✓ packages/queue/test/queue.test.ts (2 tests) 7686ms
   ✓ @zsm/queue · claim-ingestion plane (L-DD-17, live Redis) > routes a mixed firehose: reject at edge, defer, promote — never writes trunk 4831ms
   ✓ @zsm/queue · claim-ingestion plane (L-DD-17, live Redis) > a single enqueue returns a job id and the worker promotes a valid claim 2852ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
```

4831ms against a 5000ms budget — 169ms of margin. Run 1 was made with a second lane's suite running
concurrently on the same box (load average 30-49 vs ~20 for the baseline).

FULL SUITE, run 2 on the final tree with the box quiet (verbatim tail):

<!--FULL-SUITE-TAIL-2-->

### 3.3 The new tests (`packages/api/test/durable-learn.test.ts`)

```
 ✓ packages/api/test/durable-learn.test.ts (10 tests) 25076ms
   ✓ @zsm/api · durable /learn state (PGlite + crypto-shred + RLS) > RESTART — answers written over HTTP survive teardown: a NEW app over the same ZSM_DATA_DIR reproduces the mastery 4571ms
   ✓ @zsm/api · durable /learn state (PGlite + crypto-shred + RLS) > RESTART — an untouched learner is still untouched after a restart (no cross-learner bleed) 3615ms
   ✓ @zsm/api · durable /learn state (PGlite + crypto-shred + RLS) > PARITY — durable and ephemeral report the IDENTICAL mastery for the same answer sequence 3431ms
   ✓ @zsm/api · durable /learn state (PGlite + crypto-shred + RLS) > SHRED — an erased learner is 410 on every /learn route, other learners are untouched 3508ms
   ✓ @zsm/api · durable /learn state (PGlite + crypto-shred + RLS) > SHRED — the ANONYMOUS population statistics survive the erasure unchanged (DR-10/27) 2666ms
   ✓ @zsm/api · durable /learn state (PGlite + crypto-shred + RLS) > CONCURRENCY — simultaneous answers for one learner are all recorded (none swallowed by the dedupe) 3485ms
   ✓ @zsm/api · durable /learn state (PGlite + crypto-shred + RLS) > SCAFFOLD — the scaffold served with a step is PERSISTED on the event and survives a reload 3772ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  00:32:18
   Duration  32.04s (transform 2.81s, setup 0ms, collect 5.45s, tests 25.08s, environment 0ms, prepare 281ms)
```

(vitest itemises only the slower tests; the file's own count line is the authority — **10 passed**. The
three fast `ENV — …` cases are the ones not itemised.)

### 3.4 The CONCURRENCY test proved RED before it proved GREEN

With `recordAnswer` temporarily pointed straight at `appendAnswer` (the serialization bypassed):

```
 ❯ packages/api/test/durable-learn.test.ts:315:27
    315|     expect(events.length).toBe(10);
- Expected
+ Received
- 10
+ 1

 Test Files  1 failed (1)
      Tests  1 failed | 9 skipped (10)
```

Ten concurrent answers, **one** event persisted. The guard was then restored and the test is green.

---

## 4. BOOT SMOKE — BOTH MODES, ON A REAL SOCKET

### 4.1 Ephemeral (no env)

```
$ PORT=8791 node packages/api/run.mjs
[@zsm/api] learner state EPHEMERAL — set ZSM_MASTER_KEK for durability
[@zsm/api] listening on http://127.0.0.1:8791

$ curl -s http://127.0.0.1:8791/health
{"success":true,"version":"v1","data":{"status":"ok"},...}

$ curl -s "http://127.0.0.1:8791/learn/state?learner=smoke.eph"
{"success":true,"version":"v1","data":{"learner":"smoke.eph","strand":"mat.g4","eventsRecorded":0,"mastery":[],"masteredCount":0,"touchedKcs":0},...}

$ curl -s -o /dev/null -w "demo:%{http_code}\n" http://127.0.0.1:8791/
demo:200
```

Measured ephemeral boot with the new `@zsm/store` import on the path: `import_ms 1812 boot_ms 1839`
(PGlite's WASM is only instantiated by `new PGlite()`, which ephemeral mode never calls).

### 4.2 Durable — 5 answers, `SIGTERM`, restart, same state

```
$ bash _lanes/durable-learn-store/durable-smoke.sh 8794

=== BOOT 1 (durable) ===
[@zsm/api] learner state DURABLE — PGlite dataDir=/tmp/zsm-durable-smoke-MQeyfq/data
[@zsm/api] listening on http://127.0.0.1:8794
--- /learn/state after 5 answers (boot 1) ---
{"events":5,"mastered":0,"mastery":[["kc.nbt.compare",0.9886765980274832,3],["kc.g.spatial-vis",0.9311072056239016,2]]}
=== KILL (SIGTERM) — the process really dies ===
process 1916904 gone: YES
data dir on disk: 39M, 22 entries
=== BOOT 2 (same ZSM_DATA_DIR, brand-new process) ===
[@zsm/api] learner state DURABLE — PGlite dataDir=/tmp/zsm-durable-smoke-MQeyfq/data
[@zsm/api] listening on http://127.0.0.1:8794
--- /learn/state after restart (boot 2) ---
{"events":5,"mastered":0,"mastery":[["kc.nbt.compare",0.9886765980274832,3],["kc.g.spatial-vis",0.9311072056239016,2]]}
=== VERDICT ===
RESTART-SURVIVAL: GREEN — /learn/state is byte-identical across the restart
```

Two separate OS processes, one data dir, identical mastery to the last float digit.

---

## 5. FLAGs (card-vs-reality contradictions; NOT silently resolved)

**FLAG-1 — the brief's seam hint vs the code.** The brief offered "packages/api (or serving if that's
the cleaner seam)". `packages/serving` already depends on `@zsm/store` and already has a durable
loop (`serveLearner`/`recordResponse`), which the brief did not mention. The api seam was still
chosen, for the reasons in §1.1 — but the pre-existing serving seam means the repo now has TWO
durable read paths over the same event log (`serveLearner`'s `serveNext` one and `/learn`'s
`decideAdaptive` one). They fold DIFFERENTLY: `serveLearner` folds without `confusability`. That is
pre-existing and out of this lane's footprint to change, but it is a real convergence debt.

**FLAG-2 — `@zsm/store` silently dropped four `LearnerEvent` fields.** `append()` accepted events
carrying `scaffold`/`metacognition`/`encoding`/`feedback` and persisted none of them, with no error.
Any durable replay of a scaffolded log folded to different mastery than the live one. Fixed here
(§1.6) because the restart proof depends on it; flagged because it means **any learner_event rows
written before this commit have lost those fields irrecoverably** (they were never encrypted into
the blob). No such rows exist outside tests today.

**FLAG-3 — one line outside the stated footprint (`.gitignore`).** `.zsm-data/` had to be ignored or
the documented default data dir would show up as untracked junk in every `git status` after a durable
boot. It is a comment plus one pattern; no code. `pnpm-lock.yaml` also changed — the mechanical
consequence of adding the `@zsm/store` workspace dependency.

**FLAG-4 — the brief's data-dir default is ambiguous, resolved deliberately.** "default `.zsm-data/`
gitignored — in-memory PGlite when unset" cannot both be true of the same unset variable. Resolved as
§1.5: `.zsm-data/` is the SERVER default, in-memory is the LIBRARY default. Tests stay hermetic and
the server persists where the brief says.

**FLAG-5 — `410 Gone` is a new status on `/learn/*`.** Not reachable in ephemeral mode and not
reachable in durable mode until an operator crypto-shreds (no HTTP erase route exists). The
alternative — serving a shredded learner a fresh zero-mastery state — was rejected as a silent
resurrection.

**FLAG-6 — origin/main moved.** Built on the worktree snapshot `b45139e`; `origin/main` is at
`ec52477` (resolver-crossfix-w7, +2 commits). Not merged, not pushed, per the lane laws. The
integrator should expect a trivial merge (this lane touches `packages/api`, `packages/store`,
`_lanes/`, `.gitignore`, `pnpm-lock.yaml` only, and nothing under `docs/content`, `tools`, `media`).

**FLAG-7 — `packages/api/src/learn-store.ts` contained two RAW NUL BYTES** (the scaffold map's key
separator, written as a literal `\0` in the source rather than an escape). Git therefore treated the
file as BINARY — `git diff` showed only `Bin 6051 -> 7619 bytes`, i.e. this lane's change to it was
unreviewable. Replaced with the `\u0000` escape: the same runtime string, and the file is UTF-8 text
again. NOTE: **this** commit's diff for that file still renders as `Bin` — git marks a diff binary if
EITHER side is, and the HEAD side still holds the NULs — so review that one file by reading it, not
by its diff. Every diff after this commit is text. Pre-existing, not introduced here, but flagged
because it means past changes to that file were silently unreviewable too.

**FLAG-8 — multi-process durability is NOT proven.** The per-learner write serialization (§1.6b) is
in-process. It is sufficient for PGlite (one process owns the data dir) and is exactly wrong to rely
on if this is ever pointed at a shared real Postgres with more than one API process: the sequence
would then have to be minted inside the transaction (`SELECT max(ingest_seq) … FOR UPDATE`, or a
per-learner sequence). Recorded as debt rather than papered over.

**FLAG-9 — `packages/queue/test/queue.test.ts` is a LATENT FLAKE (pre-existing, untouched by this
lane).** It drives a live Redis + BullMQ worker + PGlite reconciler inside vitest's DEFAULT 5s
timeout, and takes ~4.8s when it passes — 169ms of margin. It failed on the first full-suite run of
the final tree (a second lane was running its own suite on the same box; load average 30-49) and
passed both in the baseline and on an isolated re-run of the SAME tree. Nothing in this lane touches
`packages/queue`; the only shared surface is `@zsm/store`'s `createDb()`, whose no-argument call path
is byte-identical to before (`dataDir` undefined ⇒ `new PGlite()`). The honest fix is that test
declaring a realistic timeout — one line, in a package outside this footprint, so it is REPORTED, not
silently patched here.

**PENDING-none.** No PG/broker/docker/network dependency was needed: PGlite is in-process, so the
durability proof runs with no external service.

---

## 6. COST NOTES (not defects, but known)

- Durable `POST /learn/answer` loads + decrypts the learner's whole log **4×** (before-state,
  record's seq derivation, the append itself, after-state). O(n) per answer at demo scale; a
  snapshot/cursor is the obvious optimisation when a learner's log gets long.
- Ephemeral boot now imports `@zsm/store` (for the `LearnerErasedError` class used by the `410`
  translation): measured `import_ms 1812 boot_ms 1839`. PGlite's WASM is NOT instantiated unless
  `new PGlite()` runs, which ephemeral mode never does.
- A file-backed PGlite data dir is ~39 MB for a handful of events — that is Postgres, not the events.
