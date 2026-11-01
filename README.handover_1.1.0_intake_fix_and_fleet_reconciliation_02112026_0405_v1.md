# README.handover_1.1.0 — the intake fix, the fleet reconciliation, the salvage

**Timestamp:** 02 Nov 2026, 04:05 IST
**Seat:** pk33-recovery-nov2026 · **Mode:** RECOVER
**Handover index:** 1.1.0 (supersedes 1.0.0 for the items below; 1.0.0 stands)
**Preceding:** `README.handover_1.0.0_recovery_seat_initiation_02112026_0334_v1.md`

---

## 1. Where things stand

### The disk and the CPU

| | 2026-11-02 (early) | now |
|---|---|---|
| `/` free | 206 G | **456 G** |
| `/` used | 77% | **48%** |
| CPU package | +97 °C (zk family) / +96 °C (intake) | **+34 °C** |
| load | 4.78 | 2.38 |

**Two separate CPU hogs, both now fixed:**

| hog | cause | fix |
|---|---|---|
| the zk/graphify family | `zk_graph.sh --missing` — 738 s per 10-min cron, 45/48 RED forever, 89–100 °C | paused 2026-10-31 (registry committed 2026-11-02, so it survives git recovery) |
| **the intake append** | `append()` rescanned the whole 93 MB log per event; `append_many()` did it 76× per feed | **fixed 2026-11-02** — `zcons1 944d51b` |

### The canonical home

> **`pk33backupsv1` is canonical. `awgbackups` is SKIPPED.**

Recorded in both seats' `AGENTS.md` §0 and in `pk33-cleanup/README.md`.
`pk-szt6/pk33-cleanup` is a stale mirror — do not push to it.

---

## 2. What changed since handover 1.0.0

| # | change | where |
|---|---|---|
| 1 | **the intake append fix** — 34.07 s → 0.00 s per feed, byte-identical output | `zcons1 944d51b` (pushed to `zexp1/zcons1`), efus3 `ccec0c63e` |
| 2 | **the pk registry reconciled** — 8 rows corrected in BOTH copies of the shared registry | pk `da607cb44`, pk33 `36804eccb` |
| 3 | **the two dirty worktrees preserved** three ways | `references/worktree-salvage/` + `archive/wip/pk33/*` on the SSOT |
| 4 | **the canonical home recorded** | both `AGENTS.md` §0, `pk33-cleanup/README.md` |
| 5 | **B2 verified** to hold the ncerts corpus byte-identically | `docs/STATE.md` §12 |
| 6 | the **fleet audit** written | `docs/FLEET-AUDIT.md` |
| 7 | the **secret reconciliation** — two key families, 9 disambiguated exports | `~/.secrets1/README.md` |

Full ledger rows: **4.16–4.25** in `pk33-cleanup/pk-rework-ledger-2026-10-31.md`.

---

## 3. What is paused, and how to resume it

| Item | How to resume |
|---|---|
| the six zk crons | `cd /home/pk33/zexp1/efus3 && bash scripts/pcl_selfcron.sh enable <name>` — **only after** the recreate design is agreed AND the embed upstream is restored |
| the broad cron pause (audit #3 Phase 5) | **not yet applied** — RECOVERY-PLAN §3 |
| media / sims / Blender | **FROZEN by pk** per zsm1's RESUME-HERE — do not resume without pk lifting it |
| the 22 clean worktrees | safe to prune — their tips are in the SSOT at `311036bb`. **The 2 dirty ones are now preserved**, so they can be pruned too, but committing them onto their branches first is better |
| `efus3-demoguest-merge` (11 GB) | decide: close (shift to HDD) or abandon |
| zncert-w1 Hindi | paused by rule (ADR-0011) |
| the zprotocols cron | **needs pk's answer** |
| pk's 28 mis-scoped registry rows | **pk's own estate** — fix on pk, not from pk33 |

---

## 4. What is next, in order

1. **Decide the code-graph tier** — retire or rebuild. 7.7 GB and the largest CPU
   slice. Both the Skeptic and the Architect say **retire**.
2. **Decide the embedding tier** — and there is an **offline ONNX embedder already
   on the box** (`zvec1`/bge-small, 65 MB model cached, 15× slower, zero
   dependency risk). If semantic search is not wanted, the whole tier and the
   pk31 dependency go away.
3. **Shift or delete the 131 GB ncerts corpus** — verified redundant against B2.
   Shift to HDD vs delete outright is pk's call.
4. **Prune the 22 worktrees** (now safe) — and commit the 2 dirty ones onto their
   branches first.
5. **The broad cron pause**, then the git cleanup.
6. **Restore the embed upstream** — pk31 returns, or a local embedder is chosen.
7. **Seed `zexp3/zncert2`** (0 commits) on the local Gitea.

---

## 5. What was NOT verified

| # | not verified | why it matters |
|---|---|---|
| 1 | `pnpm test` in zsm1 | inherited, never re-run here |
| 2 | whether zsm1's `evs.g3` Hindi strand is wanted | a pk-facing reviewer would want a ruling |
| 3 | whether **anything** reads `graph.json` | decides 7.7 GB |
| 4 | whether **semantic** search is wanted at all | decides the pk31 dependency |
| 5 | the zsm1 **duplicate seqs 637/638** (2026-07-02) | a historical defect, predates this work; unrepaired |
| 6 | pk's 28 mis-scoped registry rows and 57 `#PAUSED` lines | pk's estate; described but not fixed from here |
| 7 | what creates `_logs/sweep/.downstreak-aw` | one unexplained tracked deletion |
| 8 | which runtime owns the 32 `idle_inject` threads | decides which one to stop to recover a core |
| 9 | whether the 5,786 AMBIGUOUS Stage-3 rows are reachable by matching | the real size of the zsm↔zncert bridge |

---

## 6. Traps

1. **`rm -f` is blocked on this seat** — use `unlink`, or move to
   `~/.trash-<date>/` first.
2. **`pcl_selfcron.sh disable` has a substring collision** — `# pcl-selfcron:zk-index`
   is inside `# pcl-selfcron:zk-index-zdash222`. Disable **longest-tag-first**.
3. **A commented-out cron line is DEAD to `heal`** — `warden.sh` calls `heal`
   every 5 min. This is how the 2026-10-14 pause was undone. Only `disable` is durable.
4. **The registry's DISABLED state must be COMMITTED.** It was uncommitted until
   2026-11-02 — one `git checkout` would have re-armed six jobs.
5. **`~/GRAPHIFY-PAUSED-2026-10-14.md`'s restore command is a live footgun** —
   it uncomments four lines, restoring three paused jobs with no thermal check.
6. **Two DeepSeek keys exist** — `~/.secrets1/llm.env` exports the canonical one
   (`DEEPSEEK_API_KEY`) and the opencode one as `OPENCODE_DEEPSEEK_API_KEY`.
7. **`/mnt/wdhdd` is empty, not a mount** — the name is a typo for `wdhdd`.
8. **`pk31.local` does not resolve from pk33**; the bare names do (tailscale DNS).
9. **`DEAD-UNTRIAGED` does not mean dead** — it means "a human ruled on this,
   stop re-alarming". Check the live host before acting on it.
10. **Two code paths append to the intake log** — the historic duplicate seqs
    (637/638, 2026-07-02) show two writers once existed. The current flock
    discipline prevents it; the historical residue was not repaired.

---

## 7. Where to start

| If you want… | Read |
|---|---|
| the seat's rules | `../AGENTS.md` |
| the verified facts | `../docs/STATE.md` (§10 = the intake fix) |
| the fleet reality | `../docs/FLEET-AUDIT.md` |
| what the audits got wrong | `../docs/CORRECTIONS.md` |
| the three seats, resolved | `../docs/SYNTHESIS.md` |
| the ordered plan | `../docs/RECOVERY-PLAN.md` |
| the salvage | `../references/worktree-salvage/README.md` |
| the intelligence layer | `../../pk33-intelligence-recreate-nov2026/` |

---

*Handover 1.1.0. Written 02 Nov 2026 04:05 IST. Append-only.*
