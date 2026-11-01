# worktree-salvage — the two dirty Claude worktrees, preserved

**Captured:** 2026-11-02 (IST) from `/home/pk33/tzerp/zsm1-tzerp/.claude/worktrees/`
**Why:** these are the only two of the 24 worktrees holding **uncommitted work**. The other 22 are clean, and their branch tips are already ancestors of the SSOT (`efus3/zsm1` at `311036bb`) — so they need no salvage.

---

## What was here, and what the audits got wrong

Audit #3 and audit #4 said the 24 worktrees carried "unmerged `wip/pk33/*` branch
tips" and that removing them "would lose the branch tip unless pushed elsewhere".
**That was wrong.** Verified:

```
$ git branch --no-merged main      # in tzerp/zsm1-tzerp
  backup/rebirth-17sep-20260916T2346Z
  backup/rest-18sep-a … -d
* wip/pk33/vps-deploy-harness
```

None of the 24 child worktree branches. And their tips **are** in the SSOT:

```
$ git -C efus3/zsm1 merge-base --is-ancestor 7dd5b8e6 311036bb   → YES
$ git -C efus3/zsm1 merge-base --is-ancestor 2b909dda 311036bb   → YES
```

And `git worktree remove` does not delete branch refs anyway.

**The real hazard is these two dirty worktrees** — and only these two.

---

## 1. `agent-a25343b681975143d` — branch `wip/pk33/durable-learn-store`

**20 status entries: 15 tracked modifications + 5 untracked.**

Against the SSOT (`efus3/zsm1` at `311036bb`):

| file | state |
|---|---|
| `.gitignore` | DIFFERS |
| `packages/api/README.md` | DIFFERS |
| `packages/api/package.json` | same |
| `packages/api/src/app.ts` | DIFFERS |
| `packages/api/src/curriculum-source.ts` | DIFFERS |
| `packages/api/src/index.ts` | DIFFERS |
| `packages/api/src/learn-store.ts` | DIFFERS |
| `packages/api/src/routes/learn.ts` | DIFFERS |
| `packages/api/src/server.ts` | DIFFERS |
| `packages/api/tsconfig.json` | same |
| `packages/store/src/db.ts` | DIFFERS |
| `packages/store/src/eventStore.ts` | DIFFERS |
| `packages/store/src/schema.ts` | DIFFERS |
| `packages/store/test/store.test.ts` | DIFFERS |
| `pnpm-lock.yaml` | same |
| `_lanes/durable-learn-store/` | DIFFERS (2 files) |
| `packages/api/src/durable-learn-store.ts` | **NOT IN THE SSOT** |
| `packages/api/src/learn-persistence.ts` | **NOT IN THE SSOT** |
| `packages/api/test/durable-learn.test.ts` | **NOT IN THE SSOT** |

**Three files exist nowhere in the SSOT.** They are the irreplaceable part.

## 2. `agent-a7c1b95e55c30d315` — branch `wip/pk33/api-v1-wave3`

**1 modified file:** `docs/m217-zsm-curriculum/assessment-simulation-report.md`
(8 insertions, 8 deletions). Differs from the SSOT.

---

## The salvage

```
worktree-salvage/
├── agent-a25343b681975143d-wip-pk33-durable-learn-store.tracked.patch   36,994 B
├── agent-a7c1b95e55c30d315-wip-pk33-api-v1-wave3.tracked.patch            2,302 B
└── untracked/agent-a25343b681975143d/
    ├── _lanes/durable-learn-store/BUILD-RECEIPT.md
    ├── _lanes/durable-learn-store/durable-smoke.sh
    ├── packages/api/src/durable-learn-store.ts
    ├── packages/api/src/learn-persistence.ts
    └── packages/api/test/durable-learn.test.ts
```

The `.patch` files are `git diff` + `git diff --cached` from each worktree. The
`untracked/` tree is a verbatim copy of the files git did not track.

---

## How to restore

**The untracked files (do this first — they exist nowhere else):**

```bash
cd /home/pk33/tzerp/zsm1-tzerp/.claude/worktrees/agent-a25343b681975143d
cp -r /home/pk33/pk33backupsv1/pk33-recovery-nov2026/references/worktree-salvage/untracked/agent-a25343b681975143d/* .
```

**The tracked modifications:**

```bash
cd /home/pk33/tzerp/zsm1-tzerp/.claude/worktrees/agent-a25343b681975143d
git apply /home/pk33/pk33backupsv1/pk33-recovery-nov2026/references/worktree-salvage/agent-a25343b681975143d-wip-pk33-durable-learn-store.tracked.patch
```

Repeat for the second worktree with its own patch.

**Or, better — commit the work onto the branch, so it stops being at risk:**

```bash
cd /home/pk33/tzerp/zsm1-tzerp/.claude/worktrees/agent-a25343b681975143d
git add -A && git commit -m "wip(pk33/durable-learn-store): salvage of the uncommitted worktree state"
```

That is the recommendation: **commit before pruning**, so the work lives in the
branch ref and the checkout can be removed with `git worktree remove`.

---

*Captured 2026-11-02 IST. 26 files, 148 KB total.*
