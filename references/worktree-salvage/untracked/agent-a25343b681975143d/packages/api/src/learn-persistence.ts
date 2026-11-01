// The env contract that decides whether `/learn/*` state is DURABLE or EPHEMERAL, and the loud boot line that
// makes the answer impossible to miss. Two rules govern this file:
//
//   1. NEVER a silent default key. No KEK ⇒ no durability, announced at boot. A MALFORMED KEK ⇒ the boot
//      FAILS: a typo'd key must never be silently downgraded to ephemeral (learner work would vanish on the
//      next restart with nothing in the log) and must never be padded/hashed into a usable key (that would
//      manufacture a "secret" nobody chose). There is no default key constant anywhere in this tree.
//   2. NEVER a silent disk write. The library default is in-memory PGlite; only the SERVER boot path opts
//      into the on-disk default `.zsm-data/`, and `ZSM_DATA_DIR` overrides it either way.

/** 32 bytes: AES-256. The master KEK wraps every per-learner DEK (@zsm/store crypto asserts this too). */
const KEK_BYTES = 32;

export const MASTER_KEK_ENV = "ZSM_MASTER_KEK";
export const DATA_DIR_ENV = "ZSM_DATA_DIR";

/** The on-disk data dir used by the SERVER when durability is on and `ZSM_DATA_DIR` is unset (gitignored). */
export const DEFAULT_DATA_DIR = ".zsm-data";

/** Explicitly asks for no filesystem footprint (PGlite's own spelling), honoured wherever a data dir is read. */
export const IN_MEMORY_DATA_DIR = ":memory:";

/** The LOUD boot line printed whenever learner state will NOT survive a restart. Asserted by tests. */
export const EPHEMERAL_BOOT_LINE =
  "[@zsm/api] learner state EPHEMERAL — set ZSM_MASTER_KEK for durability";

/** The matching durable boot line (says WHERE, so an operator can verify the bytes land somewhere real). */
export const durableBootLine = (dataDir: string): string =>
  `[@zsm/api] learner state DURABLE — PGlite dataDir=${dataDir}`;

/** A minimal env view, so callers can pass a literal object in tests instead of mutating `process.env`. */
export type EnvLike = Readonly<Record<string, string | undefined>>;

export type LearnPersistence =
  | { readonly mode: "ephemeral" }
  | { readonly mode: "durable"; readonly kek: Buffer; readonly dataDir: string };

const isHex64 = (raw: string): boolean => /^[0-9a-fA-F]{64}$/.test(raw);

/**
 * Parse the master KEK from its env form: 64 hex chars, or base64 that decodes to exactly 32 bytes. Anything
 * else THROWS with a description of what was wrong (never the value itself — the key is never logged).
 */
export const parseMasterKek = (raw: string): Buffer => {
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new Error(`${MASTER_KEK_ENV} is set but empty — expected ${KEK_BYTES} bytes as hex or base64`);
  }
  if (isHex64(trimmed)) return Buffer.from(trimmed, "hex");

  // Buffer.from(_, "base64") is lenient (it ignores junk rather than failing), so the length check below is
  // the real gate: a malformed value cannot slip through as a short/derived key.
  const decoded = Buffer.from(trimmed, "base64");
  if (decoded.length !== KEK_BYTES) {
    throw new Error(
      `${MASTER_KEK_ENV} must be ${KEK_BYTES} bytes — 64 hex chars or base64 decoding to ${KEK_BYTES} bytes ` +
        `(got ${decoded.length} bytes after base64 decode). Generate one with: ` +
        `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`,
    );
  }
  return decoded;
};

/**
 * Resolve the persistence posture from the environment.
 *
 * @param env               the environment to read (defaults to `process.env`).
 * @param fallbackDataDir   the data dir to use when `ZSM_DATA_DIR` is unset. The SERVER passes
 *                          `DEFAULT_DATA_DIR` (state on disk); the library default is `:memory:` so an
 *                          embedding test gets durable SEMANTICS without leaving droppings on disk.
 */
export const resolveLearnPersistence = (
  env: EnvLike = process.env,
  fallbackDataDir: string = IN_MEMORY_DATA_DIR,
): LearnPersistence => {
  const rawKek = env[MASTER_KEK_ENV];
  // Absent OR empty ⇒ ephemeral. An empty var is indistinguishable from "not configured" in shell/compose
  // semantics, and the choice is NOT silent: the ephemeral boot line is printed either way. A non-empty but
  // malformed value is a different animal — someone typed a key — so that one throws.
  if (rawKek === undefined || rawKek.trim() === "") return { mode: "ephemeral" };

  const kek = parseMasterKek(rawKek); // throws on a malformed key — a config error, not a downgrade
  const rawDir = env[DATA_DIR_ENV];
  const dataDir = rawDir === undefined || rawDir.trim() === "" ? fallbackDataDir : rawDir.trim();
  return { mode: "durable", kek, dataDir };
};
