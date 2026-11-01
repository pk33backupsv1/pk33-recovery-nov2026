# SYNTHESIS.md — the three seats, and where they disagreed

**Date:** 2026-11-02 (IST) · **Inputs:**
[`ADVERSARY_A_FINDINGS.md`](../_agent-out/ADVERSARY_A_FINDINGS.md) (Skeptic) ·
[`ADVERSARY_B_FINDINGS.md`](../_agent-out/ADVERSARY_B_FINDINGS.md) (Steward) ·
[`ADVERSARY_C_FINDINGS.md`](../_agent-out/ADVERSARY_C_FINDINGS.md) (Architect)

Three seats, three models (`deepseek` / `deepseek-pro` / `MiniMax-M3`), three
stances, one question: **what is true about pk33, and what do we do next.**

This file is the synthesis. It is not a summary — it records **where they
agreed, where they conflicted, and which side the evidence supports.**

**Rule applied throughout:** a claim is only recorded here after it was
**re-verified by the seat that owns the work.** All claims below were re-run.

---

## 1. What all three seats agreed

| Finding | A | B | C | Verified |
|---|---|---|---|---|
| zsm1's depth / indianization / boundary gates are **GREEN** | ✓ | ✓ | ✓ | re-ran all four checkers |
| zcontent1 is **LIVE** and is the rework target | ✓ | ✓ | ✓ | 220 rows, 9,575 KLOs, 62 rows still unplaced |
| zncert-w1 is **LIVE and PUBLISHED** | ✓ | ✓ | ✓ | 7 gated CF Pages sites |
| the zk family's `ok=3 red=45` is a **design failure, not a work queue** | ✓ | ✓ | ✓ | 20 consecutive runs, same verdict |
| the `event` table was the opencode bloat, not the content | ✓ | ✓ | ✓ | salvaged 37,844 + 150,328 rows |
| the context packs are **real content with real consumers** | ✓ | ✓ | ✓ | 6 scripts read `zprotocols/ctx/` |
| the 24 worktrees are **worth 6.9 GB of attention** | ✓ | ✓ | ✓ | 6.86 GiB measured |
| **pk31 is the keystone** | — | ✓ | ✓ | tailscale: offline 4d |

---

## 2. Where they conflicted — and who was right

### 2.1 🔴 Did the 24 worktrees carry unmerged branch tips?

**The audits (#3, #4) said:** yes — `wip/pk33/*` branches, "unmerged work",
"would lose the branch tip".

**Seat A said:** **no.** The tips are all ancestors of the SSOT; the real
hazard is **two dirty worktrees**.

**Evidence — re-run:**

```
$ cd /home/pk33/tzerp/zsm1-tzerp && git branch --no-merged main
  backup/rebirth-17sep-20260916T2346Z
  backup/rest-18sep-a … -d
* wip/pk33/vps-deploy-harness
```

None of the 24 child worktree branches. And:

```
$ git -C /home/pk33/zexp1/efus3/zsm1 merge-base --is-ancestor 7dd5b8e6 311036bb  → YES
$ git -C /home/pk33/zexp1/efus3/zsm1 merge-base --is-ancestor 2b909dda 311036bb  → YES
```

And the dirty ones:

```
20 dirty: .../agent-a25343b681975143d     (wip/pk33/durable-learn-store)
 1 dirty: .../agent-a7c1b95e55c30d315     (wip/pk33/api-v1-wave3)
```

**Verdict: SEAT A IS RIGHT. The audits were wrong.** The 24 tips are already
in the SSOT at `311036bb`. `git worktree remove` does not delete branch refs
anyway. **The actual risk is ~26 files of uncommitted work in two worktrees** —
`packages/api/src/durable-learn-store.ts`, `learn-persistence.ts`,
`durable-learn.test.ts`, `_lanes/durable-learn-store/*`, and
`docs/m217-zsm-curriculum/assessment-simulation-report.md`.

**Consequence:** the 22 clean worktrees are **safe to prune now**. The two
dirty ones need their work committed or archived first. The justification
"unmerged branch tips" was wrong and would have led to over-caution.

### 2.2 🔴 Was the "125 s embed rebuild" honest?

**Audit #3 said:** the index "regenerates in 125 seconds".

**Seat C said:** that is the **hash-only incremental** path — only 48 docs
actually changed. The honest **cold** cost is **4,326 s (72 minutes)** for
389,206 chunks.

**Evidence — re-run:**

```
ZK EMBED: docs=35919 chunks=737128 new=34 changed=14 removed=0 secs=125.1    <- incremental
ZK EMBED: docs=15340 chunks=389206 new=6161 changed=8 removed=1 secs=4326.1  <- full
```

Plus a real crash that destroyed a 72-minute pass:
`NameError: name 'os' is not defined` at `zk_embed.py:244` (fixed later in
`fc0fc7a`).

**Verdict: SEAT C IS RIGHT.** The audits quoted the best case and called it
the rebuild. **The recreation plan must budget 72 minutes cold, not 2.**

### 2.3 🟠 How many documents are in the index?

**Audit #3 said:** 35,919 docs. **That was the `zk embed` input count.**

**Seat C said:** the FTS index actually holds **134,812 docs**; the vector
store holds 737,128 chunks over 36,145 distinct paths.

**Evidence — re-run:**

```
$ sqlite3 zdash222/_logs/zk/index.sqlite "SELECT count(*) FROM docs;"   →  134812
```

**Verdict: SEAT C IS RIGHT.** 134,812 documents. The 35,919 was a different
population (the filtered md set that got embedded). **Any coverage metric that
mixes the two populations can exceed 100%** — and Seat C found one that does:
`coverage=36145/35925 100.6%`.

### 2.4 🟠 Is the code graph worth rebuilding at all?

**Audit #3:** treated it as the "core knowledge graph rework" — i.e. rebuild it.

**Seat A:** the output is consumed by nothing but a freshness check.

**Seat C:** `zk explain` is the only reader, it has no recorded consumer, and
the A-16 register row has been `BLOCKED`/PARK since 2026-09-18 with the note
*"seat v1-knowledge is a paused Fable seat"*. **Seat C leans retire.**

**Seats A and C agree**; Seat B took the middle path (keep local search, prune
scopes, restore embeddings only when pk31 returns).

**Verdict: the evidence supports A and C.** The measured facts:
- 51 `graphify-out` dirs, **7,705 MB**
- **97 dated snapshot dirs holding 6,189 MB = 80%** of all graphify bytes, with **no reader**
- `zk_graph.sh --check` reads only an mtime

**This is pk's decision (Open Question 1 in the synthesis), and it is the
highest-leverage one in this whole initiative: it decides ~7.7 GB and the
largest chunk of the CPU budget.**

### 2.5 🟠 Was the `graphify-out` claim "untracked in every repo" true?

**Audit #2 said:** "git-ignored, regenerable — confirmed 3 ways".

**Seat A said:** **false as stated** — some repos track it.

**Verdict: SEAT A IS RIGHT on the letter.** The *regenerability* claim holds
(and Seat A confirmed the derived-ness separately), but "untracked in every
repo" was an over-generalisation from a spot check. **The regeneration
argument survives** — that is what matters for the pruning decision.

---

## 3. Things nobody had flagged — the real value of the exercise

### 3.1 🔴 The DISABLED state was uncommitted — the pause was one `git checkout` from being undone

**Seat A's most serious finding, and it is correct.**

```
$ git show HEAD:efus3/_logs/agent-crons/registry.tsv | awk '$2 ~ /^zk-/ {print $2, $8}'
zk-graph            ACTIVE
zk-index            ACTIVE
zk-index-zdash222   ACTIVE
zk-embed            ACTIVE
zk-embed-tunnel     ACTIVE
zk-report           ACTIVE
```

The working tree had all six `DISABLED`; **HEAD still had all six `ACTIVE`.**
The registry is tracked and was dirty. So *any* of these re-armed the pause:
a `git checkout --` of that file, restoring `~/registry.pre-rework.tsv`,
`pcl_selfcron.sh heal` after such a restore, an explicit `enable`, or the
hand-written restore command in `GRAPHIFY-PAUSED-2026-10-14.md`.

**✅ FIXED 2026-11-02.** The registry is now committed (`4e4599808`) with the
six entries `DISABLED` **and the human reason appended to `purpose`** (the
registry has no reason column, and `disable` leaves `purpose` untouched —
protocol P1.2.5). The pause is now durable against ordinary git recovery.

### 3.2 🔴 The growth guard was documented as "installed" but had no scheduler

**Seat A.** Correct — I wrote the script and described it in the ledger as
installed, but it had no cron entry.

**✅ FIXED 2026-11-02.** Installed through the registry:
`pcl_selfcron.sh install opencode-db-guard '17 */6 * * *' …` → now
**104 registered**, and `verify` reports it `ALIVE`.

### 3.3 🟠 Two 6.41 GiB salvage copies on the SSD

**Seat A.** Correct — the HDD copy and the SSD copy both existed.

**✅ FIXED 2026-11-02.** Byte size and row counts verified identical
(6,887,125,677 B; 37,844 / 150,328 rows), the SSD copy removed, and the HDD
copy's permissions tightened to `700`/`600` — it holds private conversations.

### 3.4 🟠 `pk` is a LIVE machine — the audits called it a dead hostname

**Seat B.** Correct, and it inverts a recommendation in audit #4.

```
$ ssh pk 'hostname; whoami'   →  pk / pk
$ tailscale status            →  100.99.62.21  pk  ...  idle
```

**The 60 `pk` registry rows belong to a real machine.** They must be
**reconciled against `pk`'s actual crontab**, not marked SUPERSEDED — which is
what audit #4 implied.

### 3.5 🟠 `aw:~/awgbackups` is EMPTY — there is no off-box backup

**Seat B.** Correct, and it changes the risk calculus.

```
$ ssh aw 'ls -la ~/awgbackups/'   →  only . and ..
```

`aw` is 86 d offline on the tailnet (LAN ssh still works). **The off-box
backup destination exists as a directory and nothing else.** Until something
is actually placed there, the real off-box tier is **GitHub (`pk33backupsv1`)
+ B2 + R2** — and B2 is live:

```
$ rclone ls b2-remote:zsm-ncert   →  17,370,445  converted-mds/2/2_clean.pdf  …
```

### 3.6 🟠 `/mnt/wdhdd` is an EMPTY DIRECTORY, not a mount

**Seat B** referenced `/mnt/wdhdd/zsm-ncert/` as containing 10,411 restored
NCERT markdown files. On pk33:

```
$ ls -la /mnt/wdhdd/   →  empty
$ df -h /mnt/wdhdd     →  /dev/nvme0n1p2  (NOT a separate filesystem)
```

It is an empty dir on the SSD, and the name is a **typo** for `wdhdd` (which
*is* a real mount). **Nothing is mounted there.** Any plan saying "the corpus
is already on /mnt/wdhdd" is wrong for pk33.

### 3.7 🟠 There is a SECOND index, and its cron is still live

**Seat C.** Verified:

```
$ ls -la efus3/_logs/zfts/   →  index.sqlite (12.3 MB), index.log
```

A separate FTS index with **1,281 docs**, whose cron (`11 4 * * *`) is **still
ACTIVE** while the whole zk family is paused. **An unexamined live component
inside a paused layer** — exactly the kind of thing a pause leaves behind.

### 3.8 🟠 There is an OFFLINE embedding path already on the box, unused

**Seat C.** Verified:

```
zexp1/zvec1/data/models/models--qdrant--bge-small-en-v1.5-onnx-q/snapshots/
  52398278842ec.../model_optimized.onnx     (65 MB, complete)
  52398278842ec.../tokenizer.json
```

`fastembed` / `BAAI/bge-small-en-v1.5`, 384-dim ONNX, **CPU, model cached
locally**. Its build cost is logged: `files=18330 chunks=140808 embedded=126468
deleted=0 in 24225.2s`.

**This changes the dependency calculus entirely.** The remote bge-m3 is
~90 chunks/s but its host is gone; the local bge-small is ~5.8 chunks/s and
**always available**. 15× slower, zero dependency risk.

⚠️ **The two are not interchangeable** — different dimensionalities (1024 vs
384), so a stored vector set **cannot be migrated** between them.

### 3.9 🟡 The zk `SKILL.md` mis-states its own schedule

**Seat C.** `efus3/skills/zk/SKILL.md:12` claims *"crons zk-index/zk-graph/
zk-embed every 6h"*. The real schedules were `*/10`, `41 */6`, `23 *` — and all
six are now `DISABLED`. **A skill that mis-states its own schedule teaches an
agent to trust stale instructions.**

### 3.10 🟡 Register rows asserting things that are false

**Seat C** found three:

- `zdash222/docs/reinit/REGISTER.tsv` row **A-16** asserts graphify *"has
  produced ZERO graph.json artifacts anywhere on pk33"* and that
  `find -name graphify-out` *"returns NOTHING machine-wide"*. **False today:**
  51 dirs, 7.7 GB, 49 `graph.json` files.
- Two `docs/dod/WORK.tsv` rows have DoDs that **cannot pass**: one requires a
  `fleet-mirror-pk` scope pointing at a removed disk; one's first conjunct is
  `curl -sf http://127.0.0.1:18095/v1/models` — a URL with **no listener since
  pk31 went offline**.

**A DoD that cannot pass is a decoration. A register whose evidence is stale
is worse than no register, because it is trusted.**

---

## 4. The corrected picture

| The audits said | The seats proved | Correction |
|---|---|---|
| 35,919 docs in the index | **134,812** | the 35,919 was the *embed input* count |
| the index "regenerates in 125 s" | **72 min cold** (4,326 s) | the 125 s was the hash-only path |
| 24 worktrees carry unmerged work | **22 clean; the tips are in the SSOT; 2 dirty** | the risk is 26 files, not 6.9 GB |
| `pk` is a dead hostname | **`pk` is live** | reconcile, don't SUPERSEDED |
| `graphify-out` untracked in every repo | **over-generalised** | regeneration holds; the wording doesn't |
| the pause is durable | **durable vs `heal`, not vs `git checkout`** | **fixed** — registry committed |
| the guard is installed | **no scheduler** | **fixed** — installed via the registry |
| — | **a second live index** (`efus3/_logs/zfts/`) | unexamined, decide explicitly |
| — | **a local ONNX embedder exists** | the dependency may be droppable |
| — | `aw:~/awgbackups` is **empty** | the real off-box tier is GitHub + B2 + R2 |
| — | `/mnt/wdhdd` is **empty, not a mount** | the "already restored" claim is wrong for pk33 |
| zsm1 is **FINALISED** | **FINALISED as a baseline, with an open tail** | see below |

### 4.1 On "zsm1 is FINALISED"

**Seat A's refinement is the right one.** The unqualified verdict is too
strong. The accurate statement:

> zsm1 is a **clean, pushed, stable SSOT baseline** with three green gates
> (depth 1961/1961, indianization 0 faults, boundary 4/4) and a **bounded open
> tail**: Hindi `G6-100` RED at 144/145 strands (99.3%) with `evs.g3` MISSING,
> ZNCERT Stage 3 open at 5,786 AMBIGUOUS rows, and the test suite **not
> re-run** in this audit.

The *practical* conclusion is unchanged — **do not "resume" zsm1's finished
arcs** — but the wording should not overstate it.

---

## 5. The decisions that are pk's, not ours

| # | Decision | Decides | Leaning |
|---|---|---|---|
| 1 | **Does the code graph earn its keep?** | **7.7 GB + the largest CPU slice** | A and C both say **retire**; B says keep local search, prune scopes |
| 2 | **Is the embedding tier wanted, and on which model?** | whether pk31 is a hard dependency | remote bge-m3 (gone) vs local bge-small (cached, 15× slower) vs **neither** — the layer becomes FTS + ripgrep only, which is what `zfts.sh`'s charter asked for in the first place |
| 3 | The **zprotocols cron** behaviour | a one-line cron other agents read | — |
| 4 | The **24 worktrees** — keep the 2 dirty ones? | ~26 files of real work | commit them first, then prune 22 |
| 5 | The **zdash222 force-push** | 82 commits vs 2 redundant | the 2 remote commits are the redundant cron reports; both tips are backed up |

---

## 6. What was changed by this review

| # | Change | Where | Verified by |
|---|---|---|---|
| 1 | the six zk registry rows committed as `DISABLED`, **with the reason in `purpose`** | `efus3` commit `4e4599808` | `git show HEAD:...` → all six `DISABLED` |
| 2 | `opencode-db-guard` installed through the registry on a 6-hourly cron | registry, 104 entries | `pcl_selfcron.sh verify` → `ALIVE` |
| 3 | the redundant 6.41 GiB SSD salvage copy removed; the HDD copy's permissions tightened to 700/600 | `/mnt/hdd1t/pk33-opencode-salvage/` | identical size + row counts verified first |
| 4 | the empty `/home/pk33/pk33-opencode-salvage/` removed | — | `rmdir` after unlinking |
| 5 | this synthesis, the corrections file, and both seats' findings committed | this org | — |

**Nothing else was changed.** The zk family is still paused. The broad cron
pause has still not happened. No repo was pruned, no worktree removed, no
scope deleted.

---

*Synthesis written 2026-11-02 IST. Every claim re-verified against a command.*
