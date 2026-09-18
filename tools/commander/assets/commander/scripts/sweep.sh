#!/usr/bin/env bash
set -euo pipefail

command -v claude >/dev/null || exit 0
sessions=$(perl -e 'alarm shift; exec @ARGV' 20 claude agents --json </dev/null 2>/dev/null) || exit 0
assignees=$(bd list --status in_progress --json --limit 0 | jq '[.[].assignee | select(. != null)]')
jq -r --arg cwd "$PWD" --argjson a "$assignees" '.[] | select(.id != null and .cwd == $cwd and ((.name // "") | startswith("w-")) and (.name as $n | $a | index($n) | not)) | .id' <<<"$sessions" |
  while read -r id; do
    claude stop "$id" </dev/null >/dev/null 2>&1 || true
    if claude rm "$id" </dev/null >/dev/null 2>&1; then echo "removed session $id"; fi
  done
