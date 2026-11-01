# CORRECTIONS.md — where the audits were wrong

**Recorded:** 2026-11-02 (IST) · **Source:** the adversarial seat review
(`../_agent-out/ADVERSARY_*_FINDINGS.md`) plus direct re-verification.

Audits #1–#4 were written by one agent with one pass. The adversarial seats
were run to find what that pass got wrong. This file records what was wrong,
what was right, and the evidence.

**Rule:** a correction is only recorded here after the claim was re-run and
confirmed. Assertion is not evidence.

---

## C1 — 🔴 `pk` is a LIVE fleet machine, not a dead hostname

**Audit #4 §4.1 said:**

> The 60 `pk` rows are from a **prior hostname**. They include 8
> `DEAD-UNTRIAGED` rows… *Second opinion wanted on: `pk` may have been a
> **renamed** pk33 rather than a different box… I could not determine which.*

**Wrong.** `pk` is a live machine on the tailnet.

```
$ ssh pk 'hostname; whoami; uptime'
pk
pk
 03:29:21 up  5:49,  3 users,  load average: 0.59, 1.05, 1.96
```

```
$ tailscale status
100.127.179.91  pk33  ky9prasoon@  linux  -
100.94.142.78   aw-1  ky9prasoon@  linux  idle, tx 4924 rx 5564
100.87.8.127    aw    ky9prasoon@  linux  offline, last seen 86d ago
100.99.62.21    pk    ky9prasoon@  linux  idle, tx 468 rx 444
100.114.44.10   pk31  ky9prasoon@  linux  idle; offline, last seen 4d ago
100.83.201.29   pk32  ky9prasoon@  linux  idle; offline, last seen 23d ago
```

**Consequence:** those **60 registry rows belong to a real machine** and must be
**reconciled, not discarded**. Marking them SUPERSEDED (the audit's implied
suggestion) would erase a live machine's cron inventory.

**Action:** reconcile the 60 `pk` rows against `pk`'s actual crontab. `ssh pk
'crontab -l'` and diff against the registry.

---

## C2 — 🔴 `aw` is offline on the tailnet but SSH still works over LAN

The audits listed `aw` as simply "reachable". More precisely:

| | |
|---|---|
| Tailnet | `aw` at `100.87.8.127` — **offline, last seen 86d ago** |
| LAN ssh | **works** — `ssh aw` → host `aw`, user `aw` |

**And `aw:~/awgbackups` is EMPTY** (verified: `ls -la` shows only `.` and `..`).

**Consequence — this is the important one:** the off-box backup destination
that a "back everything up" strategy would rely on is **not actually
populated**. Any destructive pruning on pk33 currently has **no verified
off-box fallback** except the GitHub org (`pk33backupsv1`) and B2/R2.

**Action:** either populate `aw:~/awgbackups` or treat GitHub + B2 + R2 as the
off-box tier. Do not assume `aw` is a backup target because the directory
exists.

---

## C3 — 🟠 pk31 is the single keystone, and git is not hostage to it

The audits noted pk31 was unreachable but did not establish its full role.
Verified: pk31 is simultaneously

1. the **Gitea origin** (`pk31.local:3000`) for efus3, zsm1, zcontent1, zdash222;
2. the **GPU zoo** (Qwen3.8-27B, gemma-4-26B, **bge-m3 embeddings**, Qwen2.5-VL) — the verifier bake-off *and* the embed server;
3. the **zk embed server** (`pk31:8095` → tunnel → `pk33:18095`);
4. **zncert-w1's secondary worker** (WiFi −76 dBm, ~30% SSH failures).

**The mitigating fact the audits missed: git is NOT hostage to pk31.** All four
pk31-origin repos have live GitHub mirrors — `zexp1/efus3`, `zexp1/zsm1`,
`zdash22x/zcontent1`, `zdash22x/zdash222`. **History and working copies are
recoverable right now.**

**Consequence:** the pk31 outage blocks *semantic search, the verifier
bake-off, Hindi OCR, and the canonical Gitea remotes* — but it does **not**
block the content workings.

---

## C4 — 🟠 B2 and R2 are reachable, and B2 holds the NCERT corpus

```
$ rclone listremotes
b2-remote:

$ rclone ls b2-remote:zsm-ncert
  17370445 converted-mds/2/2_clean.pdf
     5856 converted-mds/2/images/p01_01.png
     ...
```

**B2 is live from pk33** and holds the NCERT markdown/PDF corpus. This is a
genuine off-box tier for the 131 GB local corpus — which matters because
`aw:~/awgbackups` is empty (C2).

**⚠️ But verify before relying on it:** the audit has *not* confirmed that
B2's copy is **current** relative to the local `zsm-ncert-20260919` zips. A
restore from a stale B2 copy is worse than no restore. Verify freshness before
treating local corpora as prunable.

---

## C5 — 🟠 `/mnt/wdhdd` is an empty directory, not a mount

The seats referenced `/mnt/wdhdd/zsm-ncert/` (10,411 restored markdown files).
On pk33:

```
$ ls -la /mnt/wdhdd/
total 8
drwxr-xr-x 2 root root 4096 Sep 16 03:57 .
drwxr-xr-x 4 root root 4096 Sep 16 03:57 ..

$ df -h /mnt/wdhdd
/dev/nvme0n1p2  915G  420G  450G  49% /        ← NOT a separate filesystem
```

It is an **empty directory on the SSD**, and the mount point name is a typo
for `wdhdd` (which *is* a real mount — see `df`). **Nothing is mounted there.**
The "restored NCERT markdown" the seats describe is **not on this box**.

**Consequence:** any plan that says "the corpus is already on `/mnt/wdhdd`"
is wrong for pk33. It either lives on another machine, or it needs restoring
from B2 (which is live — C4).

---

## C6 — 🟡 The `zexp3/zncert2` Gitea repo is still EMPTY

The zncert-w1 HANDOVER says: *"`zexp3/zncert2` and `zexp3/zncert-w1-tracking`
exist but are EMPTY - seed them."* — **half done.**

Verified commit counts on disk, 2026-11-02:

| repo | commits |
|---|---|
| `rustzydesk` | 4 |
| `zncert2-w1` | 3 |
| `zncert-w1-tracking` | 1 |
| **`zncert2`** | **0** |

**Action:** seed `zexp3/zncert2`. Low-risk — an empty repo has no history to
lose, and the container is already Up.

---

## C7 — ✅ Confirmed correct (survived the attack)

The seats did not overturn these:

- **zsm1 is FINALISED / GREEN** — re-ran all four checkers; depth 1961/1961,
  Indianization 0 faults / 30,164 artefacts / 149 strands, boundary L1–L4 PASS,
  hindi 144/145 (99.3%), git clean, close-down commit `311036bb`.
- **zcontent1 is LIVE and is the rework target** — 220 matrix rows, 9,575 KLOs,
  218 populated, **62 rows** still `some/all KLOs unplaced in year_plan`.
  The 2026-09-19 pk ruling is the governing instruction.
- **zncert-w1 is LIVE and PUBLISHED** — English 470 chapters; Hindi 505 replicas
  untrustworthy; 3 chapters in progress; 7 gated CF Pages sites.
- **The 11 `claude-memory` rows are cosmetic, not destructive** — `zfts.py`
  does `scopes.setdefault(scope, []).append(root)`, so same-named roots merge.
  But `zk_embed.py` filters on that exact name — **do not rename the scope**.
- **The zk layer's 45/48 RED is a design failure, not a status** — confirmed by
  both the Skeptic and the Architect.
- **The opencode `event` table was the bloat, not the content** — confirmed.
- **The 24 worktree branches are a genuine open risk** — confirmed by the
  Skeptic, which is enumerating them.

---

## C8 — 🟡 Audit #3's Phase 2 instruction was mechanically wrong

Already recorded in the 2026-10-31 ledger, repeated here because it corrects a
published document: audit #3 said to edit
`zdash222/docs/registers/clones.tsv` to prune scopes. **That file is
regenerated by `bin/recon_fleet.sh` on every beat**, so a hand-edit is undone
within the hour, and the `claude-memory` rows are not in it at all — they are
appended by `bin/zk`. **The prune belongs at the scope layer**, which is where
it was actually applied (`c3fa3e7`).

---

## Net effect on the plan

Nothing in the recovery plan is invalidated. Three corrections change it:

| Change | Where |
|---|---|
| Reconcile the 60 `pk` registry rows against the **live** `pk` machine — do not SUPERSEDE them | Step 3 / new pre-step |
| Establish the real off-box tier: **GitHub + B2 + R2** (since `aw:~/awgbackups` is empty) | Step 0 |
| Verify B2 freshness before treating the 131 GB local corpus as prunable | Step 0 |
| `pk31` down blocks semantic search + bake-off + Hindi OCR + Gitea origins — **but not git** | Step 4 framing |
| Seed `zexp3/zncert2` (0 commits) | Step 2 |

---

*Corrections recorded 2026-11-02 IST. Every claim re-verified before recording.*
