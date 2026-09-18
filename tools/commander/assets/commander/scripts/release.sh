#!/usr/bin/env bash
set -euo pipefail

usage='usage: release.sh <bead-id> "<reason>"'
bead=${1:?$usage}
reason=${2:?$usage}
export BEADS_ACTOR=${BEADS_ACTOR:-coordinator}

issue=$(bd show "$bead" --json | jq '.[0]')
status=$(jq -r '.status' <<<"$issue")
assignee=$(jq -r '.assignee // ""' <<<"$issue")
stopped=""

if [ "$status" = closed ]; then
  echo "refused: $bead is closed" >&2
  exit 1
elif [ -n "$assignee" ]; then
  launch=$(bd comments "$bead" --json | jq -r --arg a "$assignee" '[.[] | select(.author == $a and (.text | startswith("dispatched: ")))] | sort_by(.created_at) | first | .text // ""')
  bd unclaim "$bead" --if-assignee "$assignee" --reason "released from $assignee: $reason" >/dev/null
  session=$(sed -n 's/.* session=\([^ ]*\).*/\1/p' <<<"$launch")
  pid=${session#pid-}
  case $launch in
    *runtime=claude*) claude stop "$session" </dev/null >/dev/null 2>&1 && stopped="claude $session" || true ;;
    *runtime=cmd*) ps -ww -p "$pid" -o command= 2>/dev/null | grep -qF "$assignee" && kill -- "-$pid" 2>/dev/null && stopped="$session" || true ;;
  esac
elif [ "$status" != open ]; then
  bd update "$bead" --status open >/dev/null
  bd comments add "$bead" "released: $reason" >/dev/null
fi

if jq -e '(.labels // []) | any(. == "needs-review" or . == "reviewing")' <<<"$issue" >/dev/null; then
  bd update "$bead" --remove-label needs-review --remove-label reviewing >/dev/null
fi

bd show "$bead" --json | jq --arg from "$assignee" --arg stopped "$stopped" '.[0] | {id, status, assignee: (.assignee // null), released_from: $from, stopped_process: $stopped}'
