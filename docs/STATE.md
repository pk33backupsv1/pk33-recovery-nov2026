# STATE.md — pk33 recovery seat, verified facts

**As of:** 2026-11-02 (IST) · **Measured by:** direct command output, not inherited
**Rule:** every number here came from a command that ran on this date. Anything
inherited is marked `[inherited]` and must be re-verified before use.

---

## 1. Machine

| Fact | Value | How measured |
|---|---|---|
| Host | pk33 | `hostname` |
| Kernel | Linux 7.0.0-38-generic | `uname -r` |
| Cores | 32 | `nproc` |
| SSD | CT1000T500 1 TB, 915 G usable, at `/` | `lsblk`, `df -h /` |
| HDD | ST1000DM003 1 TB, at `/mnt/hdd1t` | `lsblk`, `df -h /mnt/hdd1t` |
| CPU package temp | **+42 °C** (high 80, crit 100) | `sensors` |
| Load | 4.78 / 2.99 / 2.59 | `/proc/loadavg` |
| Uptime at check | ~28 min | `uptime` |

---

## 2. Disk — the 2026-11-02 shift

```
before delete:  /  663G used,  206G free  (77%)
after delete:   /  420G used,  450G free  (49%)
delta:          +244 GB freed on the SSD
```

| Path | Before | After | Note |
|---|---|---|---|
| `~/.local/share/opencode/` | **245 G** | **158 M** | db deleted; credential symlinks + snapshot remain |
| `~/.local/share/opencode/opencode.db` | 261,891,436,544 B | 4,096 B (new) | tool recreated a fresh db on next launch |
| `~/.local/share/opencode/log/` | 105 M | — | moved to `~/.trash-20261102/` |
| `/mnt/hdd1t/pk33-opencode-salvage/` | — | **6.9 G** | the salvaged real content |
| HDD free | 645 G | 638 G | |

**Salvaged content** (the real sessions, not the event-log bloat):

| File | Rows | Size |
|---|---|---|
| `messages.ndjson` | 37,844 | 6.48 GB |
| `parts.ndjson` | 150,328 | 402 MB |

Row counts match the source tables exactly. Sample-verified readable
(`{"role":"user","time":...,"agent":...,"model":...}`).

**The bloat was `event`** — 487,675 rows re-snapshotting whole messages
(avg 526 KB, max 96 MB) = ~239 GB. Not salvaged; it is the thing that was
wrong.

⚠️ **The growth mechanism is unchanged.** `scripts/opencode-db-guard.sh`
(soft limit 2 G → prune `event`; hard limit 10 G → export `message`+`part` to
HDD, then prune). See `AGENTS.md` §7.

---

## 3. Fleet reachability (2026-11-02)

| Host | Resolves | SSH | Role |
|---|---|---|---|
| **pk33** | — | self | core working seat; Gitea (rustzydesk-gitea, :3000/:2222) |
| **aw** | yes (`aw` + `aw.local`) | ✅ OK | peer; has an empty `~/awgbackups` |
| **pk** | yes | not probed | sibling seat |
| **pk31** | yes (tailscale `100.114.44.10`) | ❌ **timeout** | **hosts the primary Gitea** (`pk31.local:3000`) used as `origin` by several repos |
| **pk32** | yes (tailscale `100.83.201.29`) | ❌ **timeout** | peer seat |

**Trap:** `~/.ssh/config` maps `pk31`/`pk32`/`aw`/`pk` to `*.local` hostnames
which do **not** resolve from pk33, while the bare names do (tailscale DNS).
Use the resolvable name or the IP.

---

## 4. The intelligence layer is dead-end, not just paused

> Verified 2026-11-02 — this is the single most important operational fact.

`zk_embed.py` reads `ZK_EMBED_URL` (default `http://127.0.0.1:18095`).
Port 18095 is an **ssh tunnel to pk31:8095** — the bge-m3 embedding service.
`bin/zk_tunnel.sh` maintains it; its own header says:

> *Reversal: `pcl_selfcron remove zk-embed-tunnel`; or pk adds `ufw allow 8095`
> on pk31 + `ZK_EMBED_URL=http://pk31.local:8095`.*

**Current state:** no listener on 18095. pk31 unreachable.

```
$ curl -s -m 5 http://127.0.0.1:18095/v1/models  ->  000
$ ss -ltnp | grep 18095                          ->  (nothing)
```

**Therefore: even if every zk cron were re-enabled, `zk-embed` would fail** —
its upstream is on a machine that is currently down. The 2026-10-31 pause is
not what broke it; pk31's unreachability is.

**Implication for re-initiation:** the embedding service must be either
(a) restored on pk31, (b) re-hosted on pk33, or (c) replaced with a local
embedder — *before* any zk cron is re-enabled. Re-enabling first produces a
RED loop with no cause.

---

## 5. Cron state (verified via `pcl_selfcron.sh verify`)

```
103 registered, 1 dead
```

| Entry | State | Note |
|---|---|---|
| `zk-graph` | DISABLED | paused 2026-10-31 |
| `zk-index` | DISABLED | paused 2026-10-31 |
| `zk-index-zdash222` | DISABLED | paused 2026-10-31 |
| `zk-embed` | DISABLED | paused 2026-10-31 — also blocked by pk31 (§4) |
| `zk-report` | DISABLED | paused 2026-10-31 |
| `zk-embed-tunnel` | DISABLED | paused 2026-10-31 — would be RED anyway (§4) |
| `zdash222-wifi-5g-guard` | **DEAD** | pre-existing; no registry state, so `heal` tries to restore it every 5 min — the counter-example that motivated the `disable` protocol |

Live effective crontab lines: 98. Zero `zk`-tagged lines remain.

---

## 6. Core workings — verified state

| Component | Path | Verified state |
|---|---|---|
| **zsm1** | `zexp1/efus3/zsm1` | depth **1961/1961 (100.0%)**, indianization **0 faults** / 30,164 artefacts / 149 strands, boundary **L1–L4 PASS**, hindi **144/145 strands (99.3%)** (G6-100 still RED), **git clean** |
| **zcontent1** | `zdash22x/zcontent1` | branch `feat/content-consolidation`; KLO matrix **220 rows, 9,575 KLOs, 218 rows populated**; zsm universe 145 rows/3,019 KLOs, zncert universe 75 rows/6,556 KLOs; **62 rows** still `some/all KLOs unplaced in year_plan` |
| **zncert-w1** | `zncert-w1` | git clean; English 470 chapters published; Hindi 505 replicas untrustworthy; 3 chapters in progress; 7 gated CF Pages sites |
| **zncert Stage 3** | `efus3/zsm1/docs/m216-corpus-ingestion/zncert-sync/STAGE3-PLAN.md` | 7,995 genuine chapter rows; **CLEAN 2,144 · AMBIGUOUS 5,786 · NO-ZSM-STRAND-YET 217** |
| **zcons1** | `zexp1/efus3/zcons1` | the kernel; `intake.append()` has the known O(n) rescan defect |
| **Gitea seat** | container `rustzydesk-gitea` | live; org `zexp3`; repos `zncert2-w1`, `zncert2`, `zncert-w1-tracking`, `rustzydesk.git` |

**zsm1 close-down commit:** `311036bb close-down sweep 2026-09-18 (trunk2):
generated engine/export state committed so the submodule is clean for the rest`.

---

## 7. Archives — do not touch without a merge check

| Path | Size | Fact |
|---|---|---|
| `tzerp/zsm1-tzerp` | 8.5 G | **READ-ONLY ARCHIVE** per its own README (2026-09-16 pk decision); superseded by `zexp1/zsm1`; holds **24 Claude worktrees, 6.9 GB**, dated Jul 31–Aug 1, with `wip/pk33/*` branch names |
| `zexp1/efus3-demoguest-merge` | 11 G | in-flight seat merge; untracked `skills/_meta/bin/_logs/` |

⚠️ Run `git branch --no-merged` in `tzerp/zsm1-tzerp` before pruning anything.

---

## 8. Secrets — where things are

| Dir | Holds | Status |
|---|---|---|
| `~/.secrets1/` | **NEW 2026-11-02** — `llm.env` + 4 key files, mode 700/600 | extracted from opencode *before* the db delete; all four verified byte-identical |
| `~/.secrets2/` | `*_TEMP.env` — what the codex router reads | canonical for the router; `DEEPSEEK_API_KEY_VX`, `MINIMAX_SUBSCRIPTION_KEY` |
| `~/.secrets3/` | **names only**, values in Doppler | Doppler **unusable on this box** ("Invalid Auth token"); only `pk11devices` has a scope config |

`~/.config/opencode/opencode.jsonc` now points its three `{file:...}` apiKey
refs at `~/.secrets1/`. `~/.local/share/opencode/{auth.json,*-api-key}` are
symlinks into `~/.secrets1/`. opencode verified working after the delete
(`opencode models` lists providers; a fresh 4 KB db was created).

**Note:** the `minimax` key in `.secrets1` is **byte-identical** to
`.secrets2/MINIMAX_TEMP.env`'s value; the `deepseek` key **differs** from
`.secrets2/DEEPSEEK_TEMP.env`'s value (both 35 chars). Two different
DeepSeek keys are in play.

---

## 9. Still-open questions (need a second pair of eyes)

| # | Question | Why it matters |
|---|---|---|
| 1 | Was the 2026-10-14 graphify pause reverted deliberately or accidentally? | If accidentally it will recur after this rework |
| 2 | Is the zk scope *name* the primary key, or (name, path)? | If name-only, 11 `claude-memory` rows collide. *(Partially answered in the 2026-10-31 ledger: `zfts.py` merges same-named roots via `setdefault(scope,[]).append(root)` — cosmetic, not destructive.)* |
| 3 | Are the 24 worktree branches recoverable? | 6.9 GB of possibly-unmerged work |
| 4 | Where does the bge-m3 embed service live now — pk31 only? | Blocks any zk re-enable (§4) |
| 5 | What creates `_logs/sweep/.downstreak-aw`? | one unexplained tracked deletion in efus3 |
| 6 | Which runtime owns the 32 `idle_inject` threads — k3s or docker? | determines which one to stop to recover a core |
| 7 | Is `pk` a renamed pk33 or a different machine? | 60 stale registry rows + 8 `DEAD-UNTRIAGED` |

---

## 10. 2026-11-02 late: the intake append fix (the CPU hog is now actually fixed)

Audit #1 identified this defect on 30 Oct; it was **not fixed** then, and on
2026-11-02 it was actively burning a core every 10 minutes at **96 °C**.

### The defect

`zcons1/ssot_engine/intake.py`:

- `append()` computed the next seq with `_scan_max_seq()` — a **full read of
  the whole log**.
- `append_many()` called `append()` once per event → a 76-event feed rescanned
  a **93 MB log 76 times**.
- The rc log lives on an **HDD bind-mount** (`/dev/sda1`), so each rescan was
  also a spin-disk read.

### The fix (zcons1 `944d51b`, pushed to `zexp1/zcons1`; efus3 pointer `ccec0c63e`)

| | OLD | NEW |
|---|---|---|
| `append_many(76)` on the real 93 MB log | **34.07 s** | **0.00 s** |
| output | — | **byte-identical** (226,362 lines compared one by one) |

Two changes, both keeping the ONE-WRITER LAW:

1. **`_tail_max_seq()`** — the log is append-only and every append takes the
   flock, so seqs increase *in file order* and the last parseable line carries
   the max. Reading the last 64 KB gives the same answer at O(tail). It is used
   **only when it proves the answer**: it returns `None` on a malformed or
   unordered tail, and the caller then pays the full scan.
2. **`append_many()` scans once per batch** and assigns base+1, base+2, … under
   the same flock. A batch is now **atomic** where it previously was not —
   strictly stronger.

### Live proof (the same workload, one hour apart)

| | tick | rc log written | elapsed |
|---|---|---|---|
| old code | 03:48:06 | 03:48:46 | **40 s** |
| fixed code | 03:58:03 | 03:58:03 | **< 1 s** |

The log grew by exactly 76 events (seq 226286 → 226361), strictly increasing,
unique, no collision. **CPU package 96 °C → 34 °C.**

### Tests

`ssot_engine/tests/test_intake_append_perf.py` (new, 6 tests) pins the batch
semantics, the one-scan-per-batch property, tail/full-scan agreement, the
malformed-tail refusal, and atomicity. Suite: **22 passed**.

The wider `tests/` suite is **unchanged** by the fix — 42 failed / 241 passed
*both before and after* (pre-existing failures, verified by restoring the
original `intake.py` and getting identical counts).

### A historical defect found while verifying — NOT caused by this fix

The rc log contains **2 duplicate seqs: 637 and 638**, each appearing twice,
from **2026-07-02** — nine hours apart (`10:27` and `19:50`), both from
`emitter:iops_deploy_dev`. Three months old; predates every change in this
ledger.

**Not fixed** — repairing historical seqs in a durable log is a separate,
deliberate operation.

---

## 11. The `pk` registry — reconciled, not discarded

Audit #4 called the 60 `pk` registry rows "a hostname you no longer have" and
implied SUPERSEDED. **`pk` is live.** Full detail in `docs/FLEET-AUDIT.md`.

- The 8 rows marked `DEAD-UNTRIAGED` are **running** on `pk`. That state means
  "a human ruled on this, stop re-alarming" (CRON-DOCTRINE L5) — no such
  ruling applies to jobs that are running.
- The 6 rows marked `DISABLED` were verified **genuinely off** on `pk` — those
  labels stand.
- Corrected in both copies of the shared registry: pk `da607cb44`, pk33
  `36804eccb`.
- **Found on pk, not fixed from pk33:** 28 jobs run on pk but are registered
  under machine `pk33` (their commands point at `/home/pk/`), so pk's `verify`
  cannot see them and `heal` cannot repair them. Plus 57 `#PAUSED20260711`
  comment lines — stable, not runaway (111 → 111 over 60 s).

---

## 12. B2 holds the ncerts corpus — the off-box tier is real

```
local  /home/pk33/zsm-ncert-20260919/ncert-pdfs : 1,025 files, 140,599,609,820 bytes
B2     b2-remote:zsm-ncert/ncert-pdfs-20260919   : 1.025k objects, 140,599,609,820 bytes
```

**Byte-identical.** The 131 GB corpus is safely prunable or shiftable, and B2
is a live off-box tier — unlike `aw:~/awgbackups`, which is **empty**.

---

## 13. The two dirty worktrees are preserved

The 24 worktrees do **not** carry unmerged branch tips (their tips are
ancestors of the SSOT at `311036bb`). Only **two** are dirty, and both are
now preserved three ways:

- branch tips pushed to the SSOT's GitHub as `archive/wip/pk33/*`
  (`b45139ed2`, `a80d2039c`)
- `git diff` patches of every tracked modification
- verbatim copies of the 5 untracked files — **three of which exist nowhere
  in the SSOT**

See `references/worktree-salvage/README.md` for the restore commands.

---

---

*Verified 2026-11-02 IST. All figures from live command output.*
