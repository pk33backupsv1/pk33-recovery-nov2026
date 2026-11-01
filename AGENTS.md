# AGENTS.md — pk33 recovery seat (Nov 2026)

**You are working on pk33.** Read this file completely before you touch anything.
This seat is an *immortal seat*: it outlives the sessions that use it, and every
action you take is expected to be legible to whoever picks it up next.

---

## 1. What this seat is

pk33 is the **core working seat** of a LAN fleet. Work that appears to live
"on pk33" is often work being *served* for other machines:

| Machine | Role | Reachability from pk33 (2026-11-02) |
|---|---|---|
| **pk33** | core working seat; engine, content design, KG layer, Gitea | self |
| **pk** | sibling seat | not probed |
| **pk31** | secondary; hosts the **primary Gitea** (`pk31.local:3000`) that several repos use as `origin` | **UNREACHABLE** — tailscale `100.114.44.10:22` timeout |
| **pk32** | peer seat | **UNREACHABLE** — tailscale `100.83.201.29:22` timeout |
| **aw** | peer seat; has its own empty `~/awgbackups` | reachable via ssh |

pk33 also runs **rustzydesk-gitea** (container, ports 3000 / 2222) with the
`zexp3` org holding 4 repos: `zncert2-w1`, `zncert2`, `zncert-w1-tracking`,
`rustzydesk.git`. The zncert pipeline pushes here.

**Consequence you must internalise:** a pause on pk33 is a pause *for the
fleet*, not just locally. pk31 being down means the `origin` remote for
several repos is unavailable — check before assuming a push is possible.

---

## 2. The two hard rules

### Rule 1 — Record before you act. Always.
Every relocation, pause, commit, and destructive action gets a row in the
ledger **before** the action, or immediately after with the same turn.

```
Ledger:  ~/pk33backupsv1/pk33-cleanup/pk-rework-ledger-2026-10-31.md
Pattern: | # | date | class | target | action | before_size | after_size |
               reason | reversible | recovery |
```

`class` ∈ {`delete`, `shift`, `pause`, `commit`, `prune`, `config`}.

`recovery` is mandatory and must be an *executable* instruction — the exact
command or path that undoes the action. "It can be restored" is not a recovery
path. `bash scripts/pcl_selfcron.sh enable zk-index` is.

### Rule 2 — Never `crontab -e`.
Machine-level cron is managed by **`efus3/scripts/pcl_selfcron.sh`**, which
carries a registry (`efus3/_logs/agent-crons/registry.tsv`) and a write guard.

```
install <name> <schedule> <command> <purpose>   # register + install
disable <name>                                   # remove from crontab, KEEP registry row as DISABLED
enable <name>                                    # restore from registry data
list | verify | heal | discover | remove
```

`disable` **preserves the row** — that is the archive of record. A raw
`crontab -e` bypasses the registry, the shrink guard, and the automatic
backups. The box has been here before: `bc13b9fc5` records `heal` pumping the
crontab to **1,294 lines** because a repair verb could not recognise its own
previous repair.

**The guard's blind spot (know it):** `_ct_drop_tag` matches with `grep -vF`,
so tag `# pcl-selfcron:zk-index` is a **substring** of
`# pcl-selfcron:zk-index-zdash222`. Disabling `zk-index` will silently take
`zk-index-zdash222` with it, and the shrink guard permits it (it counts the
same way). **Always disable longest-tag-first, and `verify` after each.**

---

## 3. The two kinds of paused work — do not confuse them

This distinction is the reason this folder and its sibling exist.

| | `pk33-recovery-nov2026` (this folder) | `pk33-intelligence-recreate-nov2026` (sibling) |
|---|---|---|
| **Question** | What was working, and how do we bring it back? | What should be built differently? |
| **Content** | efus3, zcontent1, zncert-w1, zsm1, the Gitea seat, the fleet | code KG (graphify/zk), ctx packs, project graphs, KG index, embeddings |
| **Method** | **RECOVER** — restore known-good state, re-enable, verify | **RECREATE** — rebuild from source of truth |
| **Authority** | the SSOT spine + git history | the design decision, freshly made |

**The intelligence layer is RECREATE, not RECOVER.** Reason: its inputs were
rotten (a Flutter SDK, two `trash/` dirs, 11 duplicate `claude-memory` scopes),
its own derived output fed back into its index (`fd5fa4a83`: 17,701 graphify
files leaked in), and its build was structurally broken — 738 s per 10-minute
cron, `ok=3 red=45` forever. **Restoring it restores the rot.**

But the *content* workings are RECOVER: zsm1 is green and authoritative,
zcontent1 holds live pk-directed design work, zncert-w1 is a published
product. Those get restored, not rebuilt.

---

## 4. The live inventory (verify before you trust it)

Everything here was measured on 2026-11-02. **Re-verify before acting** —
this box changes.

### Core workings — RECOVER
| Component | Path | State |
|---|---|---|
| zsm1 (study-material SSOT) | `zexp1/efus3/zsm1` | **GREEN**, git clean, close-down commit `311036bb` |
| zcontent1 (KLO-universe design) | `zdash22x/zcontent1` | **LIVE** — pk's 2026-09-19 ruling; design done, build not |
| zncert-w1 (published product) | `zncert-w1` | **LIVE/PUBLISHED** — 7 gated CF Pages sites |
| zcons1 (the kernel) | `zexp1/efus3/zcons1` | live; `intake.append()` has a known O(n) defect |
| Gitea seat | `gitea/data` (rustzydesk-gitea container) | live, `zexp3` org, 4 repos |
| efus3 (the seat itself) | `zexp1/efus3` | live; 103 registered crons, 98 live effective lines |

### Intelligence layer — RECREATE (currently PAUSED)
| Component | Path | State |
|---|---|---|
| code KG | `zdash222/_logs/zk/`, 43 × `graphify-out/` | **PAUSED** — all 6 zk crons `DISABLED` |
| KG index | `zdash222/_logs/zk/index.sqlite` (2.27 GB) | stale; regenerable in 125 s |
| ctx packs | `zexp1/zprotocols/ctx/CONTEXT-v1.0.*.md` | 9 files staged-never-committed |
| embeddings | `zdash222/bin/zk_embed.py` | paused with the family |

### Archives — keep, don't touch
| Path | Size | Note |
|---|---|---|
| `tzerp/zsm1-tzerp` | 8.5 G | READ-ONLY ARCHIVE (2026-09-16); holds 24 worktrees w/ unmerged `wip/pk33/*` |
| `zexp1/efus3-demoguest-merge` | 11 G | in-flight merge; decide close-vs-shift |

---

## 5. Resource hogs — the measured facts

Measured live on pk33. Each is a real, re-measurable fact.

| Resource | Cost | Status |
|---|---|---|
| `opencode.db` event log | **244 GB** — `event` table ~239 GB, `message.updated.1` rows avg 526 KB / max 96 MB | **DELETED 2026-11-02**, content salvaged to HDD. Growth mechanism UNCHANGED — guard installed |
| `zk_graph.sh --missing` | 100% of a core, 738 s per 10-min cron, **45/48 RED every run** | **PAUSED** (2026-10-31), CPU 97 °C → 45 °C |
| `intake.append()` | rescans the whole 91 MB `rc/intake.ndjson` per event — 10.0 s for 10 appends | unfixed; degrades as the log grows |
| docker healthchecks | ~50 exec/min; RabbitMQ's `rabbitmq-diagnostics` boots a full BEAM VM (caught 244% CPU, 128 `erts_sched` threads) | unfixed |
| `idle_inject` | 32 kernel threads ≈ 99% of one core, permanent | container-runtime; not crons |
| k3s crash-loop | coredns 62 / metrics-server 72 / local-path-provisioner 73 restarts | unfixed |
| 24 Claude worktrees | 6.9 GB, 2 months stale, unmerged `wip/pk33/*` branches | **verify `git branch --no-merged` before pruning** |
| ncerts corpus | 131 GB (`zsm-ncert-20260919`), 1,025 zips, 29 languages | cold → shift to HDD |

---

## 6. Where secrets live (do not consolidate carelessly)

| Dir | Holds | Convention |
|---|---|---|
| `~/.secrets1/` | **NEW 2026-11-02** — LLM provider keys as plaintext files + `llm.env` | mode 700; values in `llm.env` (600) |
| `~/.secrets2/` | `*_TEMP.env` — what the codex router reads | canonical for the router |
| `~/.secrets3/` | **names only** (values live in Doppler) | `*_keynames.env` |

**Doppler is NOT usable on this box** — the token returns "Invalid Auth token",
and only the `pk11devices` scope has a config file. Do not attempt to
`doppler secrets get` for anything; it will fail.

`~/.secrets1` was created by extracting the four opencode credential files
*before* the db was deleted. `~/.config/opencode/opencode.jsonc` now points at
`~/.secrets1/*`, and `~/.local/share/opencode/{auth.json,*-api-key}` are
**symlinks** into it — so opencode keeps working and the values survive.

---

## 7. Working agreements

- **Git**: use `pcl_selfcron.sh disable` for cron. For repo work, commit to a
  branch with a receipt-style message; the house style is
  `<seat>: <what> (why)`. Never force-push without a backup branch.
- **Handover docs**: see `README.handover_*.md` naming convention in
  `README.protocols_1.1.1_protocols_v1.md`.
- **Adversarial review**: before any irreversible action on a paused system,
  get two seats to attack it. The pattern that worked on 2026-11-02 is three
  seats in tmux — a Skeptic, a Steward, and an Architect — each reading a
  brief from `~/pk33backupsv1/_agent-out/`. Model choice matters: run them on
  *different* models so they genuinely diverge (deepseek / deepseek-pro /
  minimax). See `references/tmux-adversarial-review.md`.
- **Never** re-enable the `zk`/graphify family to "just test it". It is
  paused for a thermal reason and the pause is a registry state, not a
  comment.
- **Never** `rm -f` a large artefact to "save space" without (a) salvaging
  its content, (b) a ledger row, and (c) verifying the recovery path.

---

## 8. When you finish a piece of work

1. Update the ledger.
2. Update `docs/STATE.md` in the relevant folder with the new verified facts.
3. If the state is worth a handover, write
   `README.handover_<i.j.k>_<context>_<DDmmmYYYY_HHMM>_v<n>.md` in the folder.
4. Commit and push.

See `README.directives_1.1.1_directives.md` for the standing directives and
`README.protocols_1.1.1_protocols_v1.md` for the protocols.
