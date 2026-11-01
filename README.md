# pk33-recovery-nov2026

**The recovery seat for pk33.** One of two working folders created 2026-11-02
under the `pk33backupsv1` GitHub org.

| | |
|---|---|
| **Purpose** | Establish what was working on pk33 and how to bring it back |
| **Scope** | The **content workings** — zsm1, zcontent1, zncert-w1, the zcons kernel, the Gitea seat, the fleet |
| **Method** | **RECOVER** — restore known-good state, re-enable, verify |
| **Sibling** | [`pk33-intelligence-recreate-nov2026`](../pk33-intelligence-recreate-nov2026) — the intelligence layer, **RECREATE** not recover |

---

## Read in this order

| # | Document | What it is |
|---|---|---|
| 1 | [`AGENTS.md`](AGENTS.md) | **Start here.** What this seat is, the two hard rules, the live inventory, where secrets live |
| 2 | [`README.directives_1.1.1_directives.md`](README.directives_1.1.1_directives.md) | The standing judgements — *why* |
| 3 | [`README.protocols_1.1.1_protocols_v1.md`](README.protocols_1.1.1_protocols_v1.md) | The protocols — *how*. Includes the handover naming convention |
| 4 | [`docs/STATE.md`](docs/STATE.md) | The verified facts, as of 2026-11-02 |
| 5 | [`docs/RECOVERY-PLAN.md`](docs/RECOVERY-PLAN.md) | The ordered re-initiation plan |
| 6 | [`references/`](references/) | Pointers to the source material this seat depends on |

**Related, elsewhere:**
- [`../pk33-cleanup`](../pk33-cleanup) — the audit set (#1–#4) and the execution ledger
- [`../_agent-out/`](../_agent-out) — the adversarial seat briefs and their findings

---

## The shape of the problem

pk33 is not broken. It is **paused** — and it is paused in a way that has a
known cause and a known cost.

**What was done (2026-10-31 → 2026-11-02):**
- The `zk`/graphify family was paused through `pcl_selfcron.sh disable` — CPU
  package **97 °C → 45 °C**.
- The KG scope list was pruned at the scope layer (61 → 53 scopes).
- The 244 GB `opencode.db` event log was deleted after its real content
  (6.9 GB) was salvaged to the HDD — **SSD 77% → 49% used, +244 GB free**.

**What is still open:**
- The `zk` family cannot simply be re-enabled: its embedding upstream is an
  ssh tunnel to **pk31:8095**, and pk31 is currently unreachable. Re-enabling
  first produces a RED loop with no cause. (`docs/STATE.md` §4)
- 24 Claude worktrees (6.9 GB) carry unmerged `wip/pk33/*` branches.
- `zcontent1`'s KLO matrix has **62 rows** still unplaced in `year_plan`.
- ZNCERT Stage 3 has **5,786 AMBIGUOUS** chapter rows to resolve.
- The broad cron pause (audit #3 Phase 5) has not happened.
- The zdash222 rebase repair left local `main` **82 commits ahead** of
  `origin/main` — a push would need `--force-with-lease` and has not been done.

---

## The two questions this folder answers

> **1. What was working, and what does it depend on?**
> → `docs/STATE.md` §6, and the recovery plan's dependency graph.

> **2. In what order do we bring it back?**
> → `docs/RECOVERY-PLAN.md` — each step with a trigger condition, the first
> observable signal that it worked, and the rollback.

---

## Rules of engagement

1. **Record before you act.** Every `delete`/`shift`/`pause`/`commit`/`prune`/`config`
   gets a ledger row with an executable recovery path.
2. **Never raw `crontab -e`.** Use `pcl_selfcron.sh`. Disable longest-tag-first;
   the tag match is a substring match.
3. **Re-verify inherited numbers.** `RESUME-HERE.md` said Indianization was
   RED with 130 faults; it was GREEN with 0.
4. **Two seats must disagree** before an irreversible action on a paused system.
5. **`rm -f` is unavailable** on this seat — use `unlink`, or move to
   `~/.trash-<date>/` first.

---

*Created 2026-11-02 IST at the pk33 recovery seat.*
