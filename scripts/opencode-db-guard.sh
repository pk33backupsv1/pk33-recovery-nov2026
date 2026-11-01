#!/usr/bin/env bash
# opencode-db-guard.sh — stop the opencode event-log blowup from recurring.
#
# WHY THIS EXISTS (the pk33 disk-full class of failure, twice):
#   2026-10-29: opencode.db reached 244 GB. The `event` table re-snapshots the
#                ENTIRE message on every update (measured: `message.updated.1`
#                rows averaged 526 KB, max 96 MB). 487,675 rows -> ~239 GB.
#   2026-11-02: the 244 GB db was deleted after salvaging the real content
#                (37,844 messages + 150,328 parts) to the HDD. A FRESH db was
#                created by the tool on next launch. The growth mechanism is
#                UNCHANGED — it will happen again.
#
# WHAT IT DOES:
#   Checks the size of opencode's db. If it crosses SOFT_LIMIT it prunes the
#   `event` table (the pure-bloat table) and VACUUMs. The real content lives
#   in `message` + `part`, which are NOT touched. If it crosses HARD_LIMIT it
#   additionally exports message+part to the HDD salvage dir, so nothing is
#   ever lost.
#
# WHERE TO RUN IT: cron, every 6h is plenty. The db grew to 244 GB over
# ~6 weeks of light use, so 6h catches it far too early to matter.
#
# CONFIG (env-overridable):
#   OPENCODE_DB       default ~/.local/share/opencode/opencode.db
#   SOFT_LIMIT_BYTES  default 2G   — prune the event table above this
#   HARD_LIMIT_BYTES  default 10G  — export + prune above this
#   SALVAGE_DIR       default /mnt/hdd1t/pk33-opencode-salvage
set -uo pipefail

DB="${OPENCODE_DB:-$HOME/.local/share/opencode/opencode.db}"
SOFT="${SOFT_LIMIT_BYTES:-2147483648}"        # 2 GiB
HARD="${HARD_LIMIT_BYTES:-10737418240}"       # 10 GiB
SALVAGE="${SALVAGE_DIR:-/mnt/hdd1t/pk33-opencode-salvage}"
LOG="${OPENCODE_GUARD_LOG:-$HOME/.local/state/opencode-db-guard.log}"

mkdir -p "$(dirname "$LOG")" 2>/dev/null
log(){ printf '%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >>"$LOG"; }

[ -f "$DB" ] || { log "no db at $DB — nothing to do"; exit 0; }

size=$(stat -c%s "$DB" 2>/dev/null || echo 0)
log "check: db=$size bytes (soft=$SOFT hard=$HARD)"

if [ "$size" -lt "$SOFT" ]; then
  log "ok: under soft limit, no action"
  exit 0
fi

command -v sqlite3 >/dev/null || { log "WARN: sqlite3 missing, cannot prune"; exit 1; }

if [ "$size" -ge "$HARD" ]; then
  log "HARD limit crossed — exporting message+part to $SALVAGE before pruning"
  mkdir -p "$SALVAGE" 2>/dev/null
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  sqlite3 "$DB" "SELECT json_object('id',id,'session_id',session_id,'data',data) FROM message;" \
    >"$SALVAGE/messages-$ts.ndjson" 2>>"$LOG" && log "exported messages -> $SALVAGE/messages-$ts.ndjson"
  sqlite3 "$DB" "SELECT json_object('id',id,'message_id',message_id,'session_id',session_id,'data',data) FROM part;" \
    >"$SALVAGE/parts-$ts.ndjson" 2>>"$LOG" && log "exported parts -> $SALVAGE/parts-$ts.ndjson"
fi

# The event table is the bloat: it re-snapshots whole messages. message+part
# hold the actual conversation. Prune only the former.
before=$(stat -c%s "$DB" 2>/dev/null || echo 0)
sqlite3 "$DB" "PRAGMA journal_mode=WAL; DELETE FROM event; VACUUM;" >>"$LOG" 2>&1
after=$(stat -c%s "$DB" 2>/dev/null || echo 0)
log "pruned: $before -> $after bytes (freed $(( (before-after)/1024/1024 )) MiB)"
exit 0
