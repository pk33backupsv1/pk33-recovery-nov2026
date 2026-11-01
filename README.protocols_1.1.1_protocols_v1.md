# README.protocols_1.1.1_protocols_v1.md — Protocols v1 (protocol 1.1.1)

**Version:** 1.1.1 · **Status:** active · **Applies to:** pk33 core working seat
**Supersedes:** none (first institutionalised version)
**Owner:** pk33 seat · **Last reviewed:** 2026-11-02 (IST)

Protocols are the *how*. Directives are the *why* — see
`README.directives_1.1.1_directives.md`.

---

## P1.1 — The Ledger Protocol

### P1.1.1 — Scope

Every action that is one of: `delete`, `shift`, `pause`, `commit`, `prune`,
`config` gets a ledger row. Read-only investigation does **not** need a row
(unless it changes state).

### P1.1.2 — Row shape

```
| # | date | class | target | action | before_size | after_size | reason | reversible | recovery |
```

- `date` — UTC, ISO-8601 with `Z`. The ledger is a machine artifact; the
  *handover* docs use IST (see P1.3).
- `before_size` / `after_size` — real numbers with units, or `n/a`.
- `reason` — why this action, in one line. Reference the audit/plan section.
- `reversible` — `yes` / `no` / `partial`.
- `recovery` — **an executable instruction**. Not "can be restored".

### P1.1.3 — Ordering

Write the row **before** the action when the action is reversible, and
**immediately after** when it is not. The reason: an irreversible action that
leaves no row is indistinguishable from an action that never happened.

### P1.1.4 — Cadence

One ledger per initiative, named `pk-rework-ledger-<YYYY-MM-DD>.md`, living in
the initiative's own repo. Not one global ledger — a global one is how entries
get lost between seats.

### P1.1.5 — Ledger location (canonical)

```
~/pk33backupsv1/pk33-cleanup/pk-rework-ledger-2026-10-31.md
```

---

## P1.2 — The Cron Protocol

### P1.2.1 — Never raw `crontab`

All machine-level cron goes through `efus3/scripts/pcl_selfcron.sh`. It
carries the registry, the shrink guard, and automatic backups. A raw
`crontab -e` bypasses all three.

### P1.2.2 — Pause by `disable`, never by commenting

`pcl_selfcron.sh disable <name>` removes the line and **keeps the registry row**
as `state=DISABLED`. A hand-commented line has no registry state, so `verify`
counts it `DEAD` and `warden.sh` (every 5 min) calls `heal` to put it back.

> **This is not theoretical.** The 2026-10-14 graphify pause was done by
> commenting lines. It was reverted, and the uncommented copy came back as the
> CPU hog. The 2026-10-31 pause was done through `disable` and has held.

### P1.2.3 — Disable order (the substring trap)

`_ct_drop_tag` uses `grep -vF`, so `# pcl-selfcron:zk-index` matches
`# pcl-selfcron:zk-index-zdash222`. **Disable longest-tag-first.** Always
`pcl_selfcron.sh verify` after each disable.

### P1.2.4 — After a pause, prove it holds

A pause that a heal cron silently undoes is not a pause. Three checks:

1. `pcl_selfcron.sh verify` → the entry reads `DISABLED`, not `DEAD`.
2. Confirm `heal` skips `DISABLED` rows.
3. Confirm the calling cron (e.g. `warden.sh`, every 5 min) cannot reinstall it.

All three were satisfied for the zk family on 2026-10-31.

### P1.2.5 — The reason belongs in the registry

`disable` has no reason column. The `purpose` field is left untouched by
`disable`, so **append the reason to `purpose`** at disable time, or the
human ledger is the only place it lives.

---

## P1.3 — The Handover Protocol

### P1.3.1 — Naming

```
README.handover_<i.j.k>_<context_or_time_or_phase_or_whatever>_<DDmmmYYYY_HHMM>_v<n>.md
```

- `<i.j.k>` — a dotted index that increases monotonically (e.g. `1.0.0`,
  `1.0.1`, `1.1.0`). The index is the *sequence*, not a semantic version.
- `<context>` — free-form slug describing what the handover is about.
- `<DDmmmYYYY_HHMM>` — **IST** timestamp (e.g. `02nov2026_0321`).
- `<n>` — revision of *this* handover (1 = first).

### P1.3.2 — Timestamps are IST in handovers, UTC in the ledger

The ledger is machine-consumed; handovers are human-consumed and pk works in
IST. Both formats appear in one tree, so state which is which in the document.

### P1.3.3 — Required sections

1. **Where things stand** — the table, current, computed.
2. **What changed since the last handover** — with the ledger row ids.
3. **What is paused and why** — with the exact `enable` command.
4. **What is next, in order** — with the first observable signal of success.
5. **What was NOT verified** — the honesty section; see P1.4.
6. **Traps** — the gotchas a newcomer would otherwise re-learn the hard way.

### P1.3.4 — Add, don't overwrite

Handover docs are append-only in spirit. A new handover is a new file; old
ones stay. Correct them with a new file, not an edit.

---

## P1.4 — The Honesty Protocol

### P1.4.1 — Separate fact from estimate

If a number was extrapolated rather than measured, say so and give the method.
The `opencode.db` 239 GB event-table figure was a **rowid-band extrapolation**,
not a full scan (a full `dbstat` scan timed out on 64 M pages). The honest
form: "239 GB (extrapolated from 40 sampled bands; cross-checked against
`PRAGMA page_count`)".

### P1.4.2 — Re-verify inherited numbers

`zsm1/RESUME-HERE.md` said Indianization was RED with 130 faults. Re-running
the checker showed **0 faults**. That doc even says: *"Re-run the checkers
before trusting any number here."* **Do.**

### P1.4.3 — State what you did not verify

A handover that lists only verified things is half a handover. The
unverified items are where the next reader's attention should go. Keep an
explicit table of open questions.

### P1.4.4 — Never claim verification you did not perform

This is the `zncert-w1` house rule and it is the box-wide rule:
*"Never claim verification you did not perform. Every number in these docs came
from a command that ran."*

---

## P1.5 — The Salvage Protocol

### P1.5.1 — Shift before delete

Deleting a large artefact is the *last* step. Order:

1. **Salvage the content** — export what is actually meaningful (not the
   bloat) to the HDD. For the opencode db: `message` + `part` (37,844 +
   150,328 rows, 6.9 GB) — not the `event` table (239 GB of re-snapshots).
2. **Verify the salvage** — row counts match the source; content is readable.
3. **Move to trash on the same filesystem** — `~/.trash-<date>/`.
4. **Copy the salvage to the HDD** — so the SSD copy is redundant.
5. **Unlink the bloat.**
6. **Verify the tool still works** — and that it does not regenerate the bloat.
7. **Ledger row** with the recovery path.

### P1.5.2 — Know the growth mechanism

Deleting the artefact is not the fix if the mechanism is unchanged. The
opencode `event` table re-snapshots whole messages on every update; the
mechanism is in the tool, not the file. Hence
`scripts/opencode-db-guard.sh`: soft-limit prune of the `event` table only,
hard-limit export-then-prune, real content (`message`+`part`) untouched.

### P1.5.3 — `rm -f` is not available on this seat

The environment's command guard rejects `rm -f style commands`. Use `unlink`
for a single file, `mv` to a trash dir first, or the `trash` helper. Plan
deletions around this.

---

## P1.6 — The Adversarial Review Protocol

### P1.6.1 — Two seats minimum before an irreversible action on a paused system

One seat proposes, one attacks. Better: three seats with *different stances*:
a Skeptic (refute), a Steward (defend + plan recovery), an Architect (argue
for rebuild). Run them in tmux so their sessions are inspectable.

### P1.6.2 — Different models, deliberately

Same model on both sides converges. Run the seats on **different** models so
they can genuinely disagree. On 2026-11-02: `deepseek` (Skeptic),
`deepseek-pro` (Steward), `MiniMax-M3` (Architect) — all through the local
router at `127.0.0.1:8787`.

### P1.6.3 — Invocation

```bash
tmux new-session -d -s <seat> -c <workdir> \
  "codex exec --model <model> --sandbox danger-full-access \
   --skip-git-repo-check '<brief>'"
```

`--skip-git-repo-check` is required outside a trusted git repo — without it
codex exits immediately with *"Not inside a trusted directory"*. This is the
single most common reason an agent seat dies at launch.

### P1.6.4 — Briefs on disk, prompts short

Each seat gets a brief file. The tmux command reads the brief path and says
"execute it completely". Long prompts in a tmux command line get mangled by
shell quoting; long content belongs in a file.

### P1.6.5 — The seats are read-only

Briefs state it explicitly: no delete, move, edit, commit, or restart. The
value of an adversarial seat is in its *analysis*, and a seat that mutates
state cannot be safely run in parallel with the work it is reviewing.

### P1.6.6 — Synthesis

The three findings files are **inputs**, not conclusions. A synthesis doc must:
state where the seats agreed, where they conflicted, and which side the
evidence supports — with a command.

---

## P1.7 — The Fleet Protocol

### P1.7.1 — pk33 serves the fleet

A pause or change on pk33 can affect work on pk, pk31, pk32, aw. Before
changing a shared surface (the Gitea seat, the shared spine, the codex router),
establish who else depends on it.

### P1.7.2 — Check reachability before assuming a remote works

As of 2026-11-02: `aw` reachable; **pk31 and pk32 unreachable** (tailscale
`100.114.44.10:22` and `100.83.201.29:22` both timeout). pk31 hosts the
**primary Gitea** that several repos use as `origin` — so `origin` pushes are
not currently possible for those repos.

### P1.7.3 — Verify the topology, don't infer it

`~/.ssh/config` maps `pk31`/`pk32`/`aw`/`pk` to `*.local` hostnames which do
**not** resolve from pk33, even though the bare names do (via tailscale DNS).
Use the IP or the resolvable name; do not assume the alias works.

---

*P1 protocols v1.1.1. Established 2026-11-02 IST at the pk33 recovery seat.*
