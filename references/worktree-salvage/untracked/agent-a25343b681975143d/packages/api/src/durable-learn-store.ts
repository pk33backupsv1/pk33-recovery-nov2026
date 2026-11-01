// The DURABLE implementation of the `LearnStore` port behind `/learn/*` — the same contract the ephemeral
// in-memory store implements, backed by @zsm/store (PGlite in-process Postgres, append-only `learner_event`,
// per-learner DEK crypto-shred, FORCE-RLS). Learner state survives a process restart; a crypto-shredded
// learner becomes unreadable rather than silently reappearing as a fresh beginner.
//
// WHY THE ADAPTER LIVES IN @zsm/api, NOT @zsm/serving: everything the port needs is api-local — the demo
// learner-handle namespace, DEMO_PARAM_VERSION, the served-scaffold side-channel fed by `/learn/next`'s D4
// decision, and the curriculum-derived confusability relation. @zsm/serving already has a durable loop
// (`serveLearner`/`recordResponse`) but it is a DIFFERENT one: serveNext-based, consent-gated, and it folds
// via `store.loadState` with no fold options. Reusing it would mean teaching the serving layer about demo
// handles and the /learn adaptive controller. This adapter deliberately MIRRORS `recordResponse`'s
// append-then-accrue contract (DR-27) rather than importing its full `ServingDeps` bundle.
//
// TWO INVARIANTS THIS FILE EXISTS TO PROTECT:
//   1. It folds HERE, with the same `FoldOptions` the ephemeral store uses — NOT via `store.loadState`, which
//      folds without `confusability` and would make durable mode report different mastery than ephemeral.
//   2. `ingestSeq` continues from the PERSISTED log, never from a process-local counter. A fresh counter
//      after a restart would re-mint `<learner>:ans:1`, and `append`'s dedupe on (learner_ref, event_id)
//      would silently DROP every post-restart answer — durable writes that quietly go nowhere.

import {
  fold,
  type ConfusabilityMap,
  type KcId,
  type LearnerEvent,
  type LearnerStateBundle,
  type Scaffolding,
  type Tombstone,
} from "@zsm/domain";
import {
  createDb,
  closeDb,
  enableRls,
  makeEventStore,
  makePopulationStats,
  LearnerErasedError,
  type EventStore,
  type PopulationStats,
  type ZsmDb,
} from "@zsm/store";
import { DEMO_PARAM_VERSION, type LearnStore } from "./learn-store.js";

export interface DurableLearnStoreOptions {
  /** The 32-byte master KEK that wraps every per-learner DEK. Required — there is NO default key. */
  readonly kek: Buffer;
  /**
   * PGlite data directory. ABSENT ⇒ in-memory PGlite: durable SEMANTICS (crypto-shred, RLS, append-only) with
   * no filesystem footprint, which is what keeps tests hermetic. A path ⇒ state survives process restarts.
   */
  readonly dataDir?: string;
  /** The inter-KC confusability relation threaded into every fold (must match the ephemeral store's). */
  readonly confusability?: ConfusabilityMap;
  /** Cohort cell for anonymous population accrual (DR-27). Learner identity is stripped at ingest. */
  readonly cohortCell?: string;
}

/**
 * The durable store plus the operations that must NOT be reachable from the serving path. `erase` is
 * admin-only (mirroring @zsm/store's own `ServingEventStore` / `EventStore` split — security review M3), so
 * it is handed out HERE and never placed on the `LearnStore` the routes hold. This lane adds no erase route.
 */
export interface DurableLearnStoreHandle {
  readonly store: LearnStore;
  /** Crypto-shred a learner: destroy their wrapped DEK. Irreversible, admin-only, no HTTP surface. */
  readonly erase: (learner: string) => Promise<void>;
  /** True iff the learner has ciphertext rows but no DEK (i.e. was shredded). */
  readonly isErased: (learner: string) => Promise<boolean>;
  /** Anonymous population sufficient-statistics — SURVIVES a learner shred by construction (DR-10/27). */
  readonly populationStats: PopulationStats;
  /** Release the PGlite instance. After this the store must not be used. */
  readonly close: () => Promise<void>;
}

/** Default cohort cell key. Carries no learner identity — just the strand the demo loop serves. */
export const DEFAULT_COHORT_CELL = "demo:mat.g4";

/** Re-exported so the routes can recognise an erased learner without importing @zsm/store directly. */
export { LearnerErasedError };

/** Same NUL separator the ephemeral store uses — a learner handle can contain anything except NUL. */
const scaffoldKey = (learner: string, kc: KcId): string => `${learner}\u0000${kc}`;

/** True iff a fold result is a live state bundle (not the erasure tombstone). */
const isBundle = (s: LearnerStateBundle | Tombstone): s is LearnerStateBundle => typeof s !== "symbol";

export const createDurableLearnStore = async (
  options: DurableLearnStoreOptions,
): Promise<DurableLearnStoreHandle> => {
  const db: ZsmDb = await createDb(options.dataDir !== undefined ? { dataDir: options.dataDir } : {});
  // RLS must be live before the first read/write: `withLearner` drops to the non-superuser `zsm_app` role,
  // which only has the granted privileges once `enableRls` has run. Both calls are idempotent, so re-opening
  // an existing data dir re-asserts the policies without touching a single persisted row.
  await enableRls(db);

  const events: EventStore = makeEventStore(db, options.kek);
  const populationStats = makePopulationStats(db);
  const cohortCell = options.cohortCell ?? DEFAULT_COHORT_CELL;
  const confusability = options.confusability;

  // Pending delivery state only (see the LearnStore doc): the scaffold SERVED for a KC but not yet answered.
  // Process-local in both implementations; the scaffold actually USED is persisted on the answered event.
  const servedScaffold = new Map<string, Scaffolding>();

  const noteServedScaffold = (learner: string, kc: KcId, scaffold: Scaffolding): void => {
    servedScaffold.set(scaffoldKey(learner, kc), scaffold);
  };

  const servedScaffoldFor = (learner: string, kc: KcId): Scaffolding | undefined =>
    servedScaffold.get(scaffoldKey(learner, kc));

  // ── Per-learner write serialization ──────────────────────────────────────────────────────────────────────
  // `recordAnswer` is read-then-append across an await, so two concurrent POSTs for the SAME learner would both
  // read seq N, both mint `<learner>:ans:N+1`, and the second insert would be swallowed by the (learner_ref,
  // event_id) dedupe — an answer accepted with a 200 and silently lost. The ephemeral store cannot hit this
  // (it never yields mid-update); the durable one must be made not to. One promise chain per learner is enough:
  // PGlite's data dir is owned by a single process, so in-process ordering IS global ordering here.
  const writeChains = new Map<string, Promise<unknown>>();

  const serializeWrite = <T>(learner: string, op: () => Promise<T>): Promise<T> => {
    const previous = writeChains.get(learner) ?? Promise.resolve();
    // `.then(op, op)` — a failed earlier write must not wedge the queue for this learner forever.
    const result = previous.then(op, op);
    const guard = result.then(
      () => undefined,
      () => undefined,
    );
    writeChains.set(learner, guard);
    // Drop the entry once this is the last write in flight, so the map cannot grow without bound.
    void guard.then(() => {
      if (writeChains.get(learner) === guard) writeChains.delete(learner);
    });
    return result;
  };

  /** The learner's decrypted log in append order. Empty for a never-seen learner; throws for a shredded one. */
  const eventsFor = (learner: string): Promise<readonly LearnerEvent[]> => events.loadEvents(learner);

  const appendAnswer = async (learner: string, itemKc: KcId, correct: boolean): Promise<number> => {
    const existing = await eventsFor(learner);
    // Continue the durable clock. Max (not length) because the log is the authority: it survives restarts,
    // and it is what `append`'s (learner_ref, event_id) dedupe is keyed against.
    const ingestSeq = existing.reduce((max, e) => (e.ingestSeq > max ? e.ingestSeq : max), 0) + 1;
    const scaffold = servedScaffold.get(scaffoldKey(learner, itemKc));
    const event: LearnerEvent = {
      eventId: `${learner}:ans:${ingestSeq}`,
      ingestSeq,
      // One epoch per answer — the true served sequence, so the confusability coupling's interleaving
      // adjacency is computed in delivery order (identical to the ephemeral store's rule).
      latticeEpoch: ingestSeq,
      learnerRef: learner,
      verb: "answered",
      objectGuid: itemKc,
      correct,
      ...(scaffold !== undefined ? { scaffold } : {}),
    };
    await events.append([event], DEMO_PARAM_VERSION);
    // Anonymous-at-ingest population accrual (DR-27), mirroring @zsm/serving's `recordResponse`. These rows
    // carry NO learner_ref, so a later crypto-shred of this learner cannot remove them — that is the point.
    await populationStats.accrue([event], cohortCell, DEMO_PARAM_VERSION);
    return existing.length + 1;
  };

  const recordAnswer = (learner: string, itemKc: KcId, correct: boolean): Promise<number> =>
    serializeWrite(learner, () => appendAnswer(learner, itemKc, correct));

  const stateFor = async (learner: string): Promise<LearnerStateBundle> => {
    const log = await eventsFor(learner); // throws LearnerErasedError for a shredded learner
    const folded = fold(
      log,
      DEMO_PARAM_VERSION,
      true,
      confusability !== undefined ? { confusability } : undefined,
    );
    if (!isBundle(folded)) {
      // keyPresent is hardcoded true (an erased learner never gets this far — `eventsFor` rejects first), so a
      // tombstone here means the fold's contract shifted under us. Fail LOUDLY rather than substitute a fresh
      // zero-mastery bundle, which would corrupt every downstream decision with no error signal.
      throw new Error(
        `durable-learn-store: fold produced a tombstone for '${learner}' with keyPresent=true — fold invariant violated`,
      );
    }
    return folded;
  };

  return {
    store: {
      durable: true,
      noteServedScaffold,
      servedScaffoldFor,
      recordAnswer,
      eventsFor,
      stateFor,
    },
    erase: (learner) => events.erase(learner),
    isErased: (learner) => events.isErased(learner),
    populationStats,
    close: () => closeDb(db),
  };
};
