# RECOVERY-PLAN.md — pk33 core workings, ordered re-initiation

**As of:** 2026-11-02 (IST) · **Status:** plan of record for this seat
**Scope:** the **content workings** only. The intelligence layer is in
[`pk33-intelligence-recreate-nov2026`](../pk33-intelligence-recreate-nov2026).

Every step carries: **trigger** (what must be true to start) · **signal** (the
first observable proof it worked) · **rollback** (how to undo). A step with no
rollback is not ready to run.

---

## The dependency shape

```
                    ┌─────────────────────────────────────┐
                    │  pk31  (embedding upstream bge-m3)  │   ← UNREACHABLE
                    │  :8095 ──ssh tunnel──> pk33:18095  │
                    └──────────────┬──────────────────────┘
                                   │ needed by
                    ┌──────────────▼──────────────┐
                    │   zk embed  (embeddings)    │
                    └──────────────┬──────────────┘
                                   │ feeds
                    ┌──────────────▼──────────────┐
                    │  zk index (35,919 docs)     │  ← RECREATE (sibling folder)
                    └──────────────┬──────────────┘
                                   │ consumed by
                    ┌──────────────▼──────────────┐
                    │  zk vsearch / KG consumers  │
                    └─────────────────────────────┘

   ┌────────────────────────────────────────────────────────────┐
   │  CONTENT WORKINGS  (independent of pk31 — RECOVER)         │
   │                                                            │
   │  zsm1 (SSOT, green) ──┬──> zcontent1 KLO ledger (live)    │
   │                       └──> zncert Stage 3 (5,786 AMBIG)   │
   │                                                            │
   │  zncert-w1 (published) ──> 7 gated CF Pages               │
   │                                                            │
   │  zcons1 kernel ──> efus3 (the seat itself)                │
   │                                                            │
   │  Gitea seat (rustzydesk-gitea) — fleet-facing             │
   └────────────────────────────────────────────────────────────┘
```

**The key structural fact:** the content workings do **not** depend on pk31.
They are recoverable now. The intelligence layer does depend on it, and that
is why it is the sibling folder.

---

## Step 0 — Close out the 2026-11-02 actions

**Trigger:** salvage verified on the HDD (done).
**Signal:** `docs/STATE.md` §2 numbers match live `df`/`du`.

Done:
- 244 GB `opencode.db` deleted; 6.9 GB content salvaged to
  `/mnt/hdd1t/pk33-opencode-salvage/`
- `~/.secrets1` created; 4 LLM keys extracted and verified byte-identical
- `opencode.jsonc` repointed at `~/.secrets1`; the 4 files in the opencode dir
  are now symlinks
- `scripts/opencode-db-guard.sh` written and dry-run

**Still to do in this step:**
- [ ] Copy the salvage to the **HDD only** (delete the SSD copy once the HDD
      copy is verified) — currently both exist, costing 6.9 GB on the SSD
      that is not needed there
- [ ] Install the guard on a 6-hour cron:
      `bash scripts/opencode-db-guard.sh`
- [ ] Ledger rows for all of the above (see the row template below)
- [ ] Remove `~/.trash-20261102/opencode-log` (105 MB, 2026-07-26→10-30,
      superseded by the salvage)

**Rollback:** everything is either reversible by symlink or recoverable from
the HDD salvage.

### Ledger rows to write

```
| 4.1 | 2026-11-01T19:20Z | config | ~/.secrets1 | created; 4 LLM keys extracted from opencode, verified byte-identical | 4 files | 5 files (700/600) | credentials must survive the db delete | yes | files are copies; originals intact until 4.3 |
| 4.2 | 2026-11-01T19:23Z | config | ~/.config/opencode/opencode.jsonc | 3 apiKey refs repointed to ~/.secrets1 | 3 refs | 3 refs | keep the tool working after the delete | yes | opencode.jsonc.bak-20261102T0325IST |
| 4.3 | 2026-11-01T19:26Z | delete | ~/.local/share/opencode/opencode.db | deleted after salvage | 261891436544 B | 4096 B (recreated) | 244 GB event-log bloat; `event` table re-snapshots whole messages | no | content in /mnt/hdd1t/pk33-opencode-salvage/ (messages.ndjson 37844 rows, parts.ndjson 150328 rows) |
| 4.4 | 2026-11-01T19:26Z | shift | ~/.local/share/opencode/opencode.log | moved to ~/.trash-20261102/ | 105 M | 105 M | superseded by the salvage | yes | mv back |
| 4.5 | 2026-11-01T19:30Z | shift | opencode messages+parts | salvaged to /mnt/hdd1t/pk33-opencode-salvage/ | 6.9 G | 6.9 G | preserve real sessions before the delete | yes | the ndjson files |
| 4.6 | 2026-11-01T19:35Z | config | scripts/opencode-db-guard.sh | created; soft-limit prune of `event`, hard-limit export+prune | — | 1 script | the growth mechanism is unchanged; do not let it return | yes | delete the script |
```

---

## Step 1 — Repoint the two stale remotes

**Trigger:** none — safe and independent.
**Signal:** `git ls-remote <remote>` returns the expected tip.

**Problem:** `efus3`, `zcontent1`, `zncert-w1` and others use
`pk31.local:3000` (Gitea) as `origin` — and **pk31 is unreachable**. Any push
to `origin` currently fails.

**Options, in order of preference:**
1. **Wait for pk31.** The Gitea data is on pk31's disk; the pk33 container
   (`rustzydesk-gitea`) is a *different* instance with the `zexp3` org.
2. **Add a `gitea` remote pointing at pk33's own container**
   (`ssh://git@127.0.0.1:2222/...`) for repos that should live there.
3. **Push to GitHub** — the orgs `zexp1`, `zexp2`, `zdash22x` are all
   accessible (the codex router and git already use them).

**Do NOT repoint `origin` blindly.** The remote layout encodes intent: which
repos are Gitea-primary vs GitHub-mirror. Repointing silently breaks the
mirror relationship.

**Rollback:** `git remote set-url origin <original>`.

---

## Step 2 — Resolve the zdash222 divergence (needs a decision, not a command)

**Trigger:** none — this is a decision point.
**Signal:** after the push, `git status -sb` shows `## main...origin/main`
with no ahead/behind.

**Current state:**

```
## main...origin/main [ahead 82, behind 2]
```

- local `main` = `c3fa3e7 zk: prune junk KG scopes (Flutter SDK, trash copies, empty memory dirs)`
- `origin/main` = `39497bc v1-knowledge: hourly computed report (cron)`
- The 2 remote-only commits are **the redundant `v1-knowledge` cron-report
  commits** — exactly what the 24-day stuck rebase was trying to eliminate.
- Both tips are preserved:
  `backup/pre-rebase-main-2026-10-31` → `39497bc`
  `backup/detached-line-2026-10-31` → `c3fa3e7`

**Assessment:** the 82-commit detached line is the real history; the 2 remote
commits are noise the rebase was discarding. A `--force-with-lease` push is
correct and safe — the remote tip is protected by `--force-with-lease` and
preserved by the backup branch.

**Rollback:** `git push --force-with-lease origin backup/detached-line-2026-10-31:main`
then `git branch -f main backup/pre-rebase-main-2026-10-31`.

⚠️ **Requires pk31 reachable** (it is the `origin` host). If pk31 stays down,
this waits.

---

## Step 3 — Freeze the cron surface (the broad pause, audit #3 Phase 5)

**Trigger:** Step 2 done, or explicitly deferred with a reason.
**Signal:** `pcl_selfcron.sh verify` shows the intended entries `DISABLED`;
`crontab -l` effective-line count drops to the intended number; **and the
65 dirty files in zdash222 stop growing**.

**Why this comes before the git cleanup:** ~250 of ~893 dirty entries are
cron-generated churn. Cleaning before pausing means it all gets dirty again
within one cycle.

**Keep running** (do not disable):
- `zk-embed-tunnel` — only if the embed service is restored (Step 4)
- anything that publishes to a live surface: `zdash222-bitz-inbox`, `ztg.sh
  poll`, `zgitea_ff.sh sync`, `zdash222-env-backup`, `b09-autoclose`
- `convo-collect`, `session-record-all` — session continuity, no truth mutation

**Disable:** the rest of the efus3 + zdash222 blocks, each through
`pcl_selfcron.sh disable`, longest-tag-first, `verify` after each.

**Rollback:** `pcl_selfcron.sh enable <name>` per entry (the registry carries
the schedule and command).

---

## Step 4 — Restore the embedding upstream (blocks the whole intelligence layer)

**Trigger:** pk31 reachable, **or** an embedder re-hosted on pk33.
**Signal:** `curl -s -m5 http://127.0.0.1:18095/v1/models` returns `200`.

**Why it is here and not in the sibling folder:** the *upstream* is a fleet
service, not an intelligence-layer design decision. The intelligence folder
decides *what to do with embeddings*; this step restores *the service*.

Options:
1. pk31 returns; `zk-embed-tunnel` re-establishes the tunnel automatically.
2. pk adds `ufw allow 8095` on pk31 and `ZK_EMBED_URL` points at
   `http://pk31.local:8095` (the tunnel's own header names this as the
   alternative).
3. Re-host bge-m3 on pk33 and set `ZK_EMBED_URL` to a local URL.

**Until this is GREEN, no zk cron may be re-enabled.** A RED embed loop with
no cause is worse than the paused state, because it looks like the pause
failed.

---

## Step 5 — Re-enable the intelligence layer — **NOT IN THIS FOLDER**

See [`pk33-intelligence-recreate-nov2026`](../pk33-intelligence-recreate-nov2026).
The rule: **recreate, do not restore.** Its scope list was rotten, its index
ingested its own output, and its build could never go green.

---

## Step 6 — Clean the git trees

**Trigger:** Step 3 done and verified (churn has stopped).
**Signal:** `git status --porcelain` shows only the genuine work.

| Repo | Dirty | Genuine content | Action |
|---|---|---|---|
| `zcontent1` | 595 | 3 TSVs + 562 `docs/history/CURRENT/*.tsv.gz` | commit the 3 TSVs; decide if history snapshots belong in git or `.gitignore` |
| `efus3` | 198 | ~15 files + 7 deletions + 1 submodule pointer | investigate `_logs/sweep/.downstreak-aw`; commit the rest |
| `zdash222` | 65 | ~8 files (3 registers, 2 dod, publish report, catalog.json, ledger) | commit the 8 |
| `zprotocols` | 19 | 9 staged `ctx/CONTEXT-v1.0.1x.md` + sha256s + `LATEST.md` | one commit — **and fix the cron** (§7) |
| `ztemp33` | 6 | 4 briefs + `lanes/` + `launch-lanes.sh` | commit or archive |
| 5 repos @ 1 | 5 | trivial | one commit each |

⚠️ **The 6 crontab-backup deletions are benign** — that dir is git-tracked
and auto-pruned to the newest 40 by `crontab_write`. Commit the pruning so
the tree stops showing them.

**Rollback:** every commit is a commit; `git reset --soft HEAD~1` or the
backup branches.

---

## Step 7 — Fix the zprotocols cron (latent inconsistency)

**Trigger:** Step 6 done.
**Signal:** after one `zctx-refresh` tick, `git status` in zprotocols is clean.

**The defect** (verified 2026-11-02): the cron is

```
zctx.sh verify || (zctx.sh compile && git add ctx && git commit && git push)
```

The `git add` is inside the `||` **fallback** branch. On the *success* path
(`verify` passes) the files are **staged and left in the index** — so they
accumulate, 9 files and counting.

**Two readings, and the fix depends on which is intended:**
- *Intended:* "compile → stage → commit → push every time." → the `||`
  grouping is a bug; move the commit out of the fallback.
- *Intended:* "only push when verify fails." → the staged files should be
  `git reset` on the success path.

**This needs pk's answer** — it is a behaviour question, not a code question.
Do not guess: the file is a context pack other agents read.

**Rollback:** `git reset` the index; the cron change is one line.

---

## Step 8 — Decide the two big open items

### 8a — The 24 Claude worktrees (6.9 GB)

**Trigger:** none — a decision.
**Signal:** `git branch --no-merged` shows (or does not show) unmerged tips.

```bash
cd /home/pk33/tzerp/zsm1-tzerp
git branch --no-merged
git worktree list
```

The parent repo is a **READ-ONLY ARCHIVE** (its own README, 2026-09-16, pk
decision) superseded by `zexp1/zsm1`. But the branch names are plainly
*unfinished work*: `api-v1-wave1/2`, `ncert-chapter-links`, `kc-graph-engine`,
`durable-learn-store`, `edge-surgery-w6`, `b2-ncert-inventory`,
`hindi-mapping-pilot`, `sims-seal-1`, `sims-round-2`, `objective-debt-1b`,
`cement-b1-b5`, `lessons-pilot`, `hygiene-w5`, `scig10-gapfill`,
`resolver-crossfix-w7`, `binding-precision-w7`, `narrations-tier-a`,
`narration-source-repairs`, `hpe-prereq-edges`.

**Recommended:** push every `wip/pk33/*` tip to a branch on the GitHub org
first, *then* prune the worktrees. 6.9 GB against 450 GB free is not urgent;
losing unmerged work is not recoverable.

### 8b — `efus3-demoguest-merge` (11 GB)

**Trigger:** none — a decision.
**Signal:** —

An in-flight seat merge (`zdash22v21-demoguest-merge`) with a receipt-style
commit trail. Either it is finished (shift the checkout to the HDD — the git
history goes with it) or it is abandoned (same). Either way it is a git repo,
so the *history* is safe wherever the checkout lives.

---

## Step 9 — Resume the content workings

**Trigger:** Steps 1–8 done, or explicitly deferred with reasons.
**Signal:** each has its own first observable output.

### 9a — zcontent1 KLO ledger (the live pk-directed work)

The 2026-09-19 pk ruling: **two parallel KLO universes** (`zsm-KLO`,
`zncert-KLO`) on one grade ladder gK–g12, every HLP build-up hanging off a
KLO, cross-linked where they coincide.

Current: 220 matrix rows, 9,575 KLOs, 218 rows populated.
**62 rows** still `some/all KLOs unplaced in year_plan`.

**First signal:** one row moves from `year_plan` gap to placed, and the
matrix rebuild (`bin/build_klo_universe_matrix.py`) reflects it.

### 9b — ZNCERT Stage 3 (the zsm↔zncert bridge)

7,995 genuine chapter rows: **CLEAN 2,144 · AMBIGUOUS 5,786 · NO-ZSM-STRAND-YET 217**.
2,302 of 2,347 Devanagari rows already carry a strand candidate — they need
title-level matching, not strand discovery.

**First signal:** the AMBIGUOUS count falls below 5,786 and the verdict split
is recomputed from a command.

### 9c — zncert-w1 Hindi

505 chapters of replicas whose text is **not trustworthy** (ADR-0011 marks it
red; 0 of 107 chapters produced Devanagari). English is published; Hindi is
not, by rule D1.4.

**First signal:** a chapter that was red becomes green — measured by the
chapter's own gate, not by eye.

### 9d — zsm1 Hindi (G6-100)

**144/145 strands GREEN (99.3%)**. One strand short. Its own RESUME-HERE says
the next move is the chunked conveyor over the settled corpus
(`_lanes/zlessonplan/g7ds/g6_chunked.sh`), then confirm via
`g6_hindi_status.py` exiting 0.

**First signal:** `g6_hindi_status.py` exits 0.

---

## What stays paused

| Item | Why |
|---|---|
| The `zk`/graphify family | until Step 4 is GREEN **and** the sibling folder's recreation design is agreed. Not "until someone looks at it" |
| The broad cron pause (Step 3) | until Step 6's git cleanup is agreed |
| `zk-embed-tunnel` | until pk31 is reachable — it is RED anyway |
| Media / sims / Blender | **FROZEN by pk** per zsm1's RESUME-HERE. Do not resume without pk lifting it |
| `tzerp/zsm1-tzerp` worktrees | until Step 8a |
| The `zctx-refresh` cron behaviour | until pk answers §7 |

---

## Open questions for pk

1. **§7 — the zprotocols cron.** Is the intent "always commit" or "commit only
   on failure"? This changes a one-line cron and it governs how other agents
   read context packs.
2. **§8a — the 24 worktrees.** Are the `wip/pk33/*` tips wanted? They are
   6.9 GB of plausibly-unmerged feature work.
3. **Step 4 — the embed service.** Does bge-m3 stay on pk31, move to pk33, or
   get replaced?
4. **§2 — the force-push.** Confirm the 82-commit line is authoritative and the
   2 remote cron-report commits are droppable.

---

*Plan of record 2026-11-02 IST. Every step carries trigger, signal, rollback.*
