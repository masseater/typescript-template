#!/usr/bin/env bash
set -euo pipefail

usage="usage: dispatch.sh <claude|codex|cmd> <bead-id>"
runtime=${1:?$usage}
bead=${2:?$usage}
protocol="$(cd "$(dirname "$0")/.." && pwd)/worker-protocol.md"

case $runtime in
  claude) command -v claude >/dev/null || { echo "claude not found" >&2; exit 2; } ;;
  codex) echo "codex: non-interactive launch command is unverified on this machine (codex --version hangs); nothing dispatched. Use runtime cmd with WORKER_CMD once verified." >&2; exit 2 ;;
  cmd)
    WORKER_CMD=${WORKER_CMD:-}
    [ -n "$WORKER_CMD" ] || { echo "runtime cmd needs WORKER_CMD (the prompt is appended as the last argument)" >&2; exit 2; }
    command -v "${WORKER_CMD%% *}" >/dev/null || { echo "WORKER_CMD: ${WORKER_CMD%% *} is not an executable command" >&2; exit 2; }
    ;;
  *) echo "$usage" >&2; exit 2 ;;
esac

bd ready --json --limit 0 |
  jq -e --arg id "$bead" 'any(.[]; .id == $id and ((.labels // []) | any(. == "needs-human" or . == "needs-review") | not))' >/dev/null ||
  { echo "refused: $bead is not ready (blocked, claimed, closed, needs-human, needs-review or unknown)" >&2; exit 1; }

export BEADS_ACTOR="w-$bead-$$-$RANDOM"
bd update "$bead" --claim --json >/dev/null || { echo "refused: claim failed for $bead" >&2; exit 1; }

prompt="あなたは bead $bead を担当するワーカーで、actor 名は $BEADS_ACTOR です。最初に $protocol を読み、その手順に従ってください。次に bd show $bead を実行して作業を始めてください。"
log="${TMPDIR:-/tmp}/$BEADS_ACTOR.log"

launch() {
  case $runtime in
    claude)
      claude --bg --name "$BEADS_ACTOR" ${WORKER_MODEL:+--model "$WORKER_MODEL"} "$prompt" </dev/null |
        sed -e $'s/\x1b\\[[0-9;]*m//g' -ne 's/.*backgrounded · \([^ ]*\) · .*/\1/p'
      ;;
    cmd)
      nohup perl -e 'setpgrp; exec @ARGV' $WORKER_CMD "$prompt" </dev/null >"$log" 2>&1 &
      sleep 2
      kill -0 $! 2>/dev/null || return 1
      echo "pid-$! log=$log"
      ;;
  esac
}

session=$(launch) && [ -n "$session" ] || {
  bd unclaim "$bead" --reason "dispatch: $runtime の起動に失敗したため解放" >/dev/null
  echo "launch failed: $bead released" >&2
  exit 1
}

bd comments add "$bead" "dispatched: runtime=$runtime session=$session" >/dev/null
jq -n --arg bead "$bead" --arg actor "$BEADS_ACTOR" --arg runtime "$runtime" --arg session "${session%% *}" '$ARGS.named'
