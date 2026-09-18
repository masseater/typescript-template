#!/usr/bin/env bash
set -euo pipefail

usage='usage: finish.sh <bead-id> <actor> "<result per acceptance criterion>"'
bead=${1:?$usage}
actor=${2:?$usage}
report=${3:?$usage}

result=$("$(dirname "$0")/checkpoint.sh" "$bead" "$actor" "完了報告: $report")

if jq -e '.next == "continue" and (.new_comments | length) == 0' <<<"$result" >/dev/null; then
  bd update "$bead" --add-label needs-review --actor "$actor" >/dev/null
  jq -n '{next: "finished", instruction: "レビュー待ちにした。bead は close せず、これで終了する。"}'
else
  jq 'if .next == "continue" then .instruction = "完了はまだ記録されていない。new_comments を読む。止まるよう求めるものがあれば「3. 中断」を行う。質問や依頼にはコメントで答え、必要な作業を済ませてから finish.sh をもう一度実行する。" else . end' <<<"$result"
fi
