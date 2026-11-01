# README.directives_1.1.1_directives.md — Standing Directives v1 (directive 1.1.1)

**Version:** 1.1.1 · **Status:** active · **Applies to:** pk33 core working seat
**Owner:** pk · **Recorded:** 2026-11-02 (IST)

Directives are the *why* — the standing judgements that decide what gets
built, kept, paused, and thrown away. Protocols (`README.protocols_1.1.1_protocols_v1.md`)
are the *how*.

A directive may be superseded by pk. When it is, the superseding directive
gets a new number and this file records the supersession — the old directive
stays visible, because knowing what was believed and when is part of the
institution.

---

## D1.1 — What pk33 is FOR

> **pk33 is the core working seat of the fleet.** It is where work is *served*
> from for pk, pk31, pk32 and aw — not merely where it is authored. It also
> hosts the self-hosted Gitea that the local server stack pushes to.

**Consequence:** availability decisions on pk33 are fleet decisions. Before
pausing anything shared, establish who depends on it.

---

## D1.2 — Recover the content workings; recreate the intelligence layer

> **Content workings are RECOVERED. The intelligence layer is RECREATED.**

This is the load-bearing distinction of the whole initiative.

**Content workings** (zsm1, zcontent1, zncert-w1, the zcons kernel, the Gitea
seat) have real content, a real source of truth, and a real consumer. They get
restored, verified, and re-enabled.

**The intelligence layer** (code KG / graphify, `zk` index, ctx packs, project
graphs, embeddings) is *derived data with a rotten input set*. It had:

- a scope list containing a 2.2 GB Flutter SDK and two `trash/` directories
- 11 duplicate `claude-memory` scope rows
- its own derived output fed back into its own index (17,701 files, per
  `fd5fa4a83`)
- a build that could never succeed — 738 s against a 10-minute cron,
  `ok=3 red=45` forever
- a thermal consequence — the CPU package at **89–100 °C** (crit 100)

Restoring it restores the rot. It gets rebuilt from a stated source of truth,
with a scope policy, a bounded runtime, and a verification gate.

---

## D1.3 — Preserve pk's own words verbatim

> **When pk states a ruling, quote it exactly and date it. Do not paraphrase
> a decision into a summary that loses its force.**

The `zcontent1` README does this and it is the right model: pk's 2026-09-19
ruling about the two parallel KLO universes is recorded verbatim, with the
timestamp, and the file is append-only ("later entries append, never
overwrite").

This applies to our own documents too. A paraphrase of a ruling is a new
ruling.

---

## D1.4 — A wrong artifact is worse than no artifact

> **Never ship a text layer, a graph, or an index that is known to be wrong.
> Absence is a valid state. A confident wrong thing is not.**

This is the `zncert-w1` house rule, and it generalises: the Hindi OCR was
marked red and *not published* rather than published wrong. Apply it to the
intelligence layer — a scope that cannot be satisfied should be RED and
excluded, not half-built.

Corollary: **a perpetual RED is a design failure, not a status.** The old
`zk_graph.sh` produced 45 REDs every run for 738 seconds. That is the system
telling you the design is wrong, and the correct response is to change the
design, not to retry harder.

---

## D1.5 — Compute, don't remember

> **Every number in a document came from a command that ran.**

If a figure is inherited from a prior document, it is stale the moment the
world moves. Re-run the checker. `zsm1/RESUME-HERE.md` said Indianization was
RED with 130 faults; re-running the checker showed **0 faults**.

Corollary for the intelligence layer: **a graph with no reproducible build is
not knowledge, it is folklore.** If it cannot be rebuilt from a clean
checkout in a stated time, it does not get restored.

---

## D1.6 — Record before you destroy

> **Every relocation, pause, and destructive action is a ledger row with an
> executable recovery path.**

Not a summary. Not a changelog line. A row with the exact command that undoes
it. The ledger is the difference between "we know why this is gone" and "we
will find out in six months".

---

## D1.7 — Pause is a state, not a comment

> **A pause that a repair cron can silently undo is not a pause.**

`heal` exists to restore dead-but-registered crons. A hand-commented line is
*exactly* that state. The graphify pause of 2026-10-14 was undone by this
mechanism, and the CPU went back to 97 °C. Pauses go through
`pcl_selfcron.sh disable`, which records `state=DISABLED` — a state `heal`
explicitly skips.

---

## D1.8 — Secrets have a home, and it is not the app's data dir

> **Credentials live in `~/.secrets1` (values) and `~/.secrets3` (names only,
> values in Doppler). An application's data directory is not a secret store.**

The four LLM provider keys lived inside `~/.local/share/opencode/`, inside the
directory whose 244 GB event log was about to be deleted. Extracting them
*first* turned a destructive action into a safe one.

Doppler is **not usable on this box** (token invalid; only `pk11devices` has a
scope config). `.secrets3` remains the names-only index for future
re-population. Do not attempt `doppler secrets get` and expect success.

---

## D1.9 — Back up generously, to the HDD, with intent

> **The SSD is the working surface. The HDD is the archive. Anything cold
> goes to the HDD; anything hot stays on the SSD.**

131 GB of ncert zips: cold, shift to the HDD. `zncert-w1/library`: the
*source* corpus for the active content pipeline, keep on the SSD — random
reads of 2,569 PDFs on a spinning disk during a build will be slow.

The HDD bind-mount pattern (`ssot_engine_efus3/{dc,rc}`) is already proven in
production via `/etc/fstab`. Extend it; do not invent a second mechanism.

---

## D1.10 — Two seats must disagree before the irreversible

> **Before an irreversible action on a paused system, have at least two seats
> attack the plan — and make them different seats, on different models, with
> different stakes.**

One seat proposes; one refutes. Three is better: Skeptic (refute), Steward
(defend + recovery plan), Architect (argue for rebuild). The whole point is
that they *disagree*; a single model on both sides converges on the same
blind spot.

Their findings are inputs, not conclusions. A synthesis states where they
agreed, where they conflicted, and which side the evidence supports.

---

## D1.11 — An immortal seat is legible to its successor

> **Write for the person who arrives cold, in six months, with no memory of
> this session.**

That means: measured facts with the command that produced them; the trap that
was nearly stepped in; the thing that was deliberately *not* done and why;
and the open questions that need a second pair of eyes.

Handover docs are the mechanism. The naming convention is fixed
(`README.handover_<i.j.k>_<context>_<DDmmmYYYY_HHMM>_v<n>.md`, IST). They are
append-only.

---

## D1.12 — Adversarial seats do not mutate

> **A reviewing seat that edits the thing it is reviewing cannot be trusted,
> and cannot run in parallel with real work.**

The adversarial seats are read-only by construction. Their output is a
findings file. The synthesis is written afterwards, by the seat that owns the
work.

---

## Supersession log

| Date (IST) | Directive | Superseded by | Note |
|---|---|---|---|
| 2026-11-02 | — | — | first institutionalised version of the directives |

---

*Directives v1.1.1. Established 2026-11-02 IST at the pk33 recovery seat.*
