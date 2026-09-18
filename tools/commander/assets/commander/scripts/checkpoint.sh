#!/usr/bin/env bash
set -euo pipefail

usage='usage: checkpoint.sh <bead-id> <actor> "<progress>"'
bead=${1:?$usage}
export BEADS_ACTOR=${2:?$usage}
progress=${3:?$usage}

mine=$(bd show "$bead" --json | jq --arg me "$BEADS_ACTOR" '.[0] | .status == "in_progress" and .assignee == $me')
if [ "$mine" != true ]; then
  jq -n '{next: "abandon", instruction: "この bead はもうあなたの担当ではない。bead には何も書かず、ただちに作業を終了する。"}'
  exit 0
fi

bd comments add "$bead" -- "$progress" >/dev/null
comments=$(bd comments "$bead" --json)
blocked=$(bd blocked --json)

jq -n --arg id "$bead" --arg me "$BEADS_ACTOR" --argjson comments "$comments" --argjson blocked "$blocked" '
  ($comments // [] | sort_by(.created_at) | to_entries) as $c
  | [$c[] | select(.value.author == $me) | .key] as $mine
  | [$c[] | select(.key < $mine[0] and (.value.author | startswith("w-"))) | .key] as $predecessors
  | (if ($mine | length) > 2 then $mine[-2] else $predecessors[-2] // -1 end) as $previous
  | [$c[]
     | select(.key > $previous and .value.author != $me
              and (.key > $mine[0] or (.value.author | test("^(w-|coordinator$)") | not)))
     | .value | {author, text, created_at}] as $new
  | ([$blocked[]? | select(.id == $id) | .blocked_by[]?]) as $by
  | (if ($by | length) > 0 then "stop" else "continue" end) as $next
  | {
      next: $next,
      instruction: (
        if $next == "stop" then "bead がブロックされた。プロトコルの「3. 中断」（notes に状態を書く → bd unclaim → 終了）を今すぐ行う。"
        elif ($new | length) > 0 then "new_comments を読む。止まるよう求めるものがあれば「3. 中断」を行う。質問や依頼にはコメントで答える。それ以外は次の一歩を 1 つだけ行い、また checkpoint.sh を実行する。"
        else "次の一歩を 1 つだけ行い、終えたらすぐまた checkpoint.sh を実行する。" end),
      blocked_by: $by,
      new_comments: $new
    }'
