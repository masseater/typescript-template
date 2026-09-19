#!/usr/bin/env bash
set -euo pipefail

if ! command -v claude >/dev/null; then
  echo "sweep failed: claude is not on PATH" >&2
  exit 1
fi
if ! sessions=$(perl -e 'alarm shift; exec @ARGV' 20 claude agents --json </dev/null 2>/dev/null); then
  echo "sweep failed: could not list claude agents" >&2
  exit 1
fi
assignees=$(bd list --status in_progress --json --limit 0 | jq '[.[].assignee | select(. != null)]')
jq -r --arg cwd "$PWD" --argjson a "$assignees" '.[] | select(.id != null and .cwd == $cwd and ((.name // "") | startswith("w-")) and (.name as $n | $a | index($n) | not)) | .id' <<<"$sessions" |
  while read -r id; do
    if ! claude stop "$id" </dev/null >/dev/null 2>&1; then
      echo "sweep failed: could not stop session $id" >&2
      exit 1
    fi
    if claude rm "$id" </dev/null >/dev/null 2>&1; then echo "removed session $id"; fi
  done
