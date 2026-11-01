#!/usr/bin/env bash
# Durable-learner-state boot smoke with a REAL process restart.
#
#   boot the server durable → answer 5 items over HTTP → SIGTERM the process → boot a NEW process over the
#   SAME ZSM_DATA_DIR → assert /learn/state is byte-identical.
#
# Nothing is mocked and nothing is in-process: two separate OS processes, one data dir on disk.
# Usage: bash _lanes/durable-learn-store/durable-smoke.sh [port]

set -u
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
WORK=$(mktemp -d -t zsm-durable-smoke-XXXXXX)
DATA=$WORK/data
mkdir -p "$DATA"

export ZSM_MASTER_KEK=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")
export ZSM_DATA_DIR=$DATA
export PORT=${1:-8792}
BASE=http://127.0.0.1:$PORT

cleanup() {
  [ -f "$WORK/smoke.pid" ] && kill "$(cat "$WORK/smoke.pid")" 2>/dev/null
  sleep 1
  rm -rf "$WORK"
}
trap cleanup EXIT

# Extract one field from a JSON response on stdin without adding a dependency.
jsonf() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(String($1))})"; }

start() {
  node "$ROOT/packages/api/run.mjs" > "$1" 2>&1 &
  echo $! > "$WORK/smoke.pid"
  for _ in $(seq 1 60); do
    sleep 1
    curl -sf "$BASE/health" >/dev/null 2>&1 && return 0
  done
  echo "SERVER DID NOT COME UP"; cat "$1"; return 1
}

answer_once() {
  local learner=$1 item
  item=$(curl -s "$BASE/learn/next?learner=$learner" | jsonf "j.data.items[0].itemId")
  curl -s -X POST "$BASE/learn/answer" -H 'content-type: application/json' \
    -d "{\"learner\":\"$learner\",\"item_id\":\"$item\",\"correct\":true}" >/dev/null
}

snapshot() {
  curl -s "$BASE/learn/state?learner=smoke.dur" |
    jsonf "JSON.stringify({events:j.data.eventsRecorded,mastered:j.data.masteredCount,mastery:j.data.mastery.map(m=>[m.kcId,m.masteryProb,m.opportunities])})"
}

echo "=== BOOT 1 (durable) ==="
start "$WORK/dur1.log" || exit 1
head -2 "$WORK/dur1.log"
for _ in 1 2 3 4 5; do answer_once smoke.dur; done
echo "--- /learn/state after 5 answers (boot 1) ---"
snapshot | tee "$WORK/state-before.json"; echo

echo "=== KILL (SIGTERM) — the process really dies ==="
PID=$(cat "$WORK/smoke.pid")
kill "$PID"; sleep 3
if kill -0 "$PID" 2>/dev/null; then echo "STILL ALIVE — forcing"; kill -9 "$PID"; sleep 2; fi
echo "process $PID gone: $(kill -0 "$PID" 2>/dev/null && echo NO || echo YES)"
echo "data dir on disk: $(du -sh "$DATA" | cut -f1), $(ls "$DATA" | wc -l) entries"

echo "=== BOOT 2 (same ZSM_DATA_DIR, brand-new process) ==="
start "$WORK/dur2.log" || exit 1
head -2 "$WORK/dur2.log"
echo "--- /learn/state after restart (boot 2) ---"
snapshot | tee "$WORK/state-after.json"; echo

echo "=== VERDICT ==="
if diff -q "$WORK/state-before.json" "$WORK/state-after.json" >/dev/null; then
  echo "RESTART-SURVIVAL: GREEN — /learn/state is byte-identical across the restart"
else
  echo "RESTART-SURVIVAL: RED"; diff "$WORK/state-before.json" "$WORK/state-after.json"; exit 1
fi
