# references/ — where the source material lives

Everything this seat depends on, with what each is for and how fresh it is.
Paths are absolute; they were verified on 2026-11-02 (IST).

---

## The plan of record (in this org)

| Path | What |
|---|---|
| `~/pk33backupsv1/pk33-cleanup/pk-load-audit-1-30oct0134hrs.md` | CPU/load assessment — why the box looked hot but wasn't starved |
| `~/pk33backupsv1/pk33-cleanup/pk-prune-assessment-2-30oct0134hrs.md` | storage prune + HDD-shift — ~460 GB recoverable |
| `~/pk33backupsv1/pk33-cleanup/pk-rework-assessment-3-30oct0134hrs.md` | the start point: cron recording, finalised-vs-live, dirty trees, 7-phase plan |
| `~/pk33backupsv1/pk33-cleanup/pk-observations-gotchas-audit-4-30oct0134hrs.md` | 20 tagged findings for second opinion |
| `~/pk33backupsv1/pk33-cleanup/pk-rework-ledger-2026-10-31.md` | **the ledger** — every relocation/pause/destructive action with a recovery path |
| `~/pk33backupsv1/pk33-cleanup/human_typed.md` | verbatim record of the 9 prompts that started this |

## The adversarial seats

| Path | What |
|---|---|
| `~/pk33backupsv1/_agent-out/ADVERSARY_A.md` | the Skeptic's brief (refute) |
| `~/pk33backupsv1/_agent-out/ADVERSARY_B.md` | the Steward's brief (defend + plan recovery) |
| `~/pk33backupsv1/_agent-out/ADVERSARY_C.md` | the Architect's brief (argue for recreate) |
| `~/pk33backupsv1/_agent-out/ADVERSARY_*_FINDINGS.md` | their outputs |

## The system this seat manages

| Path | What | Note |
|---|---|---|
| `/home/pk33/.codex/router/codex_router.py` | the local model router (`:8787`) | one provider in front of DeepSeek + MiniMax; `aliases.json` maps model names |
| `/home/pk33/.codex/router/aliases.json` | model aliases | `deepseek`→`deepseek-flash`, `deepseek-pro`→`deepseek-v4-pro` |
| `/home/pk33/.codex/config.toml` | codex config | `model_provider = "router"` |
| `/home/pk33/.codex/router/codex_router.py` | reads `~/.secrets2` | **canonical** for the router |
| `/home/pk33/.secrets2/*_TEMP.env` | the router's credentials | `DEEPSEEK_API_KEY_VX`, `MINIMAX_SUBSCRIPTION_KEY` |
| `/home/pk33/.secrets1/` | **NEW 2026-11-02** | the opencode-family LLM keys |
| `/home/pk33/.secrets3/*_keynames.env` | names only | values live in Doppler — **which is unusable on this box** |
| `/home/pk33/.codex/memories/` | the memory folder | 5 files dirty (git-tracked) |

## The cron registry (machine truth)

| Path | What |
|---|---|
| `/home/pk33/zexp1/efus3/scripts/pcl_selfcron.sh` | **the cron manager** — `install/disable/enable/list/verify/heal/discover/remove` |
| `/home/pk33/zexp1/efus3/_logs/agent-crons/registry.tsv` | the registry — 13 columns, 103 rows for pk33, 169 across machines |
| `/home/pk33/zexp1/efus3/_logs/agent-crons/crontab-backups/` | 40 newest crontab snapshots, auto-rotated, **git-tracked** |
| `/home/pk33/crontab.pre-rework.20261031T215718Z.txt` | the pre-rework crontab snapshot |
| `/home/pk33/registry.pre-rework.tsv` | the pre-rework registry snapshot |
| `/home/pk33/GRAPHIFY-PAUSED-2026-10-14.md` | the hand-written 2026-10-14 pause note ⚠️ **its restore command would re-enable 3 jobs — a live footgun** |

## The core workings (RECOVER)

| Path | What |
|---|---|
| `/home/pk33/zexp1/efus3/` | the eduZ monorepo — the seat itself. `README.md` is the orientation doc |
| `/home/pk33/zexp1/efus3/zsm1/` | the study-material SSOT. `README.md`, `RESUME-HERE.md` ⚠️ **stale — re-run the checkers** |
| `/home/pk33/zexp1/efus3/zcons1/` | the ONE zcons kernel (kc·dc·rc). `ssot_engine/intake.py` has the known O(n) defect |
| `/home/pk33/zdash22x/zcontent1/` | the live KLO-universe design work. `README.md` carries pk's ruling verbatim; `docs/DESIGN-TWO-UNIVERSES.md`, `docs/KLO-UNIVERSE-MATRIX.tsv` |
| `/home/pk33/zncert-w1/` | the published product. `README.md`, `docs/HANDOVER.md`, `docs/adr/` (12 ADRs) |
| `/home/pk33/zexp1/efus3/zsm1/docs/m216-corpus-ingestion/zncert-sync/STAGE3-PLAN.md` | ZNCERT Stage 3 — the zsm↔zncert bridge |
| `/home/pk33/gitea/data/` | the Gitea seat's persistent data |

## The intelligence layer (RECREATE)

| Path | What |
|---|---|
| `/home/pk33/zdash22x/zdash222/bin/zk` | scope generation (the `scopes` subcommand) |
| `/home/pk33/zdash22x/zdash222/bin/zk_graph.sh` | the graphify driver — the 738 s offender |
| `/home/pk33/zdash22x/zdash222/bin/zk_embed.py` | the embedder — reads `ZK_EMBED_URL` → pk31:8095 |
| `/home/pk33/zdash22x/zdash222/bin/zk_report.sh` | the report (also commits + pushes) |
| `/home/pk33/zdash22x/zdash222/_logs/zk/scopes.tsv` | the scope list — 53 rows after the 2026-10-31 prune |
| `/home/pk33/zdash22x/zdash222/_logs/zk/index.sqlite` | the doc store — 2.27 GB |
| `/home/pk33/zexp1/efus3/scripts/zfts.py` | the walker — `PRUNE_DIRS` at line ~42, `SPINE_RE` just below |
| `/home/pk33/zexp1/zprotocols/ctx/` | the context packs — 51 files, 220 KB, 6 consumers |
| `/home/pk33/zexp1/efus3/skills/zk/SKILL.md` | the skill doc — explains what zk was FOR |

## Fleet

| Path | What |
|---|---|
| `/home/pk33/.ssh/config` | fleet host aliases ⚠️ **the `*.local` names do not resolve from pk33** |
| `tailscale status` | the real topology: pk33 + aw-1 + pk online; aw 86d, pk31 4d, pk32 23d offline |
| `pk31.local:3000` | the primary Gitea — **offline** (pk31 down) |
| `127.0.0.1:3000` / `127.0.0.1:2222` | the **local** Gitea container — healthy |
| `b2-remote:` (rclone) | B2 — **live**; holds the NCERT corpus at `zsm-ncert/` |

---

*Reference index verified 2026-11-02 IST.*
