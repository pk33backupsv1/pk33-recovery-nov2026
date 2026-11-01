# FLEET-AUDIT.md — the pk registry reconciliation, 2026-11-02

**Triggered by:** Seat B's finding that `pk` is a **live machine** (audit #4 had
called it "a hostname you no longer have"). That inverted a recommendation, so
the 60 `pk` registry rows had to be reconciled rather than discarded.

**Scope:** the pk33-side copy of the shared selfcron registry, and the live
`pk` host's own registry.

---

## 1. The finding

`efus3/_logs/agent-crons/registry.tsv` is a **shared** registry — one file per
repo checkout, holding rows for every machine, so agents on one seat can see
what other seats have institutionalised.

The `pk` rows in pk33's copy said:

```
60 rows for machine "pk"
  - 8  state=DEAD-UNTRIAGED
  - several state=DISABLED
```

Audit #4 read the `DEAD-UNTRIAGED` rows as "a prior machine identity that no
longer exists" and suggested marking them SUPERSEDED. **That would have been
wrong.**

---

## 2. What was verified

### 2.1 `pk` is live

```
$ ssh pk 'hostname; whoami; uptime'
pk
pk
 03:29:21 up  5:49,  3 users,  load average: 0.59, 1.05, 1.96

$ tailscale status
100.99.62.21    pk    ky9prasoon@  linux  idle, tx 468 rx 444
```

### 2.2 The 8 `DEAD-UNTRIAGED` jobs are **running**

Each was checked on the live host — crontab line present and uncommented:

```
LIVE   y_nudger.sh
LIVE   clio_scan.sh
LIVE   session_record_all.sh
LIVE   session_specs_readme.sh
LIVE   lanes_heartbeat.sh
LIVE   lane_tier_guard.sh
LIVE   lane_progress_collect.sh
LIVE   zcorpus-backup-weekly
```

And their registry commands resolve to real paths **on that host**
(`/home/pk/...`, not `/home/pk33/...`).

### 2.3 What `DEAD-UNTRIAGED` actually means

From `scripts/pcl_selfcron.sh` (CRON-DOCTRINE L5):

```bash
# Triaged terminal states (CRON-DOCTRINE L5 state machine): visible, never
# counted DEAD — a row a human/machine already ruled on is not a silent loss
# to re-alarm every cycle.
case "$state" in
  DEAD-UNTRIAGED|SUPERSEDED*) echo "  $state $name"; continue;;
esac
```

So the state means *"someone ruled on this — stop re-alarming about it."* It is
**not** a synonym for "dead."

**But no such ruling applies to these 8** — they are running. The label was
applied on 2026-07-28 (all 8 share that timestamp) and never re-examined.

### 2.4 The 6 `DISABLED` rows are correct

All 6 are genuinely absent from pk's crontab:

```
ag-escalate-1.sh  ag_deploy.sh  ag_metrics.sh  reg-lint-1.sh
z3-wave100-pk2    zmcp-flow-keepalive
```

Those labels stand.

---

## 3. The fix

Corrected in **both** places, because the registry is shared and a stale copy
re-seeds the wrong state:

| Where | Change | Commit |
|---|---|---|
| `pk`'s own registry | 8 rows `DEAD-UNTRIAGED` → `ACTIVE` | `da607cb44` (on pk) |
| pk33's copy of the shared registry | same 8 rows | `36804eccb` (on pk33) |

After the fix, `pk`'s own `verify` reports **62 registered, 1 dead** — the
remaining dead entry is `sau-feed`, pre-existing and unrelated.

**Recovery:** `git revert` on either machine.

---

## 4. A second, larger problem found while checking: pk's registry is mis-scoped

| | pk33 | pk |
|---|---|---|
| live jobs tagged `pcl-selfcron:` | 96 | **84** |
| registry rows for this machine | 104 | **62** |
| effective (uncommented) jobs | 98 | 43 |
| **live jobs invisible to this seat's `verify`** | **0** | **28** |

On `pk`, **28 jobs are running but registered under machine `pk33`** — so pk's
`verify` never checks them and `heal` can never repair them. They are
(pk's own jobs, misfiled):

```
10min-window  afed-export  afed-oracle  afed-serve  alert-iops
eo-verify-driver  fast-pulse  fun-friday-sync  know-signal-1
lane_heartbeat.sh  log-integrity-organ  organ-red-pager
pcl_decision_capture.sh  pcl_hr.sh  sau-feed-oracle  sau-keeper
seat-memory  session-register  sys-secops-1  twdpt1-autosync  usage-audit
warden.sh  zrac-findings-daily  zsm-wave-loop  zsm_lane_heartbeat.sh
zwrit-bridge-sweep  zwrit-oracle-hourly  zwrit-pulse-5min
```

**Decisive evidence — their commands point at `/home/pk/`:**

```
fast-pulse            -> /home/pk
sau-keeper            -> /home/pk
warden.sh             -> /home/pk
zsm_lane_heartbeat.sh -> /home/pk
zwrit-pulse-5min      -> /home/pk
usage-audit           -> /home/pk
```

**pk33's own registry is clean** — 0 invisible jobs. The mis-scoping is
pk-side only.

### 4.1 The `#PAUSED20260711` pattern on pk — 57 lines

```
$ ssh pk 'crontab -l | grep -c "^#PAUSED"'   →   57      (pk33: 1)
```

These are the **exact** corruption named in efus3 commit `bc13b9fc5`:

> 17 registry rows carried `sched="#PAUSED20260711 47 0 * *"` — a schedule cron
> cannot parse. `tagged_line` writes it verbatim, so each "healed" entry landed
> as a COMMENT: never runs, stays DEAD forever, gets appended again next tick.

**On pk they are not runaway** — the `heal` fixes (a: refuse an unparseable
schedule, b: dedup on the tag across the whole file including comments) are
present in pk's copy of `pcl_selfcron.sh`. Measured over 60 s:

```
crontab lines: 111 → 111   (delta 0)
effective:      43
```

**Stable.** The 57 `#PAUSED` lines are the residue of the July incident, kept
as comments (they document the pause), and the 3-per-tag pattern
(`zload-sample`, `tty-sampler`, `tg-beat-multi`, `session-economics`,
`revert-hunter` each ×3) is the same comment/effective/comment trio, not
duplication.

⚠️ **But 57 of them are still in pk's crontab as comments, and the 28
mis-scoped registry rows mean `verify` there cannot see them.** Worth a
dedicated pass on pk — **not from pk33.**

---

## 5. What this changes about the recovery plan

| Item | Change |
|---|---|
| The 60 `pk` registry rows | **reconciled** — not SUPERSEDED. 8 were ACTIVE all along. |
| pk's registry scoping | **28 live jobs are invisible to pk's `verify`** — a pk-side repair, not a pk33 one |
| pk's `#PAUSED` residue | 57 comment lines, stable, no runaway. A cleanup opportunity, not an incident |
| pk31 | still the keystone, still down 4d. **`pk` being alive does not substitute for it** — pk31 hosts the Gitea origin and the GPU/embed box |

---

## 6. Not done

- **pk's 28 mis-scoped rows were NOT re-homed.** That means editing pk's
  registry rows from pk33 — the row's `machine` field is the identity of the
  host it describes, and rewriting it from another host risks racing pk's own
  `heal`. It belongs on pk.
- **pk's 57 `#PAUSED` comment lines were NOT cleaned.** Same reason.
- **pk's `sau-feed` DEAD entry was NOT healed.** Pre-existing, unrelated, and
  `heal` would reinstall a job whose purpose should be confirmed first.

---

*Reconciled 2026-11-02 IST. Every claim re-verified against the live `pk` host.*
