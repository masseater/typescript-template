#!/usr/bin/env bash
set -euo pipefail

stale_minutes=${STALE_MINUTES:-20}
in_progress=$(bd list --status in_progress --json --limit 0)
blocked=$(bd blocked --json)
ready=$(bd ready --json --limit 0)
human=$(bd list --label needs-human --json --limit 0)
review=$(bd list --label needs-review --json --limit 0)

comments=$(
  jq -rn --argjson a "$in_progress" --argjson b "$human" --argjson c "$review" '($a + $b + $c)[] | select((.comment_count // 0) > 0) | .id' | sort -u |
    while read -r id; do
      bd comments "$id" --json | jq -c --arg id "$id" '{($id): sort_by(.created_at)}'
    done | jq -s 'add // {}'
)

sessions=null
if jq -e 'any(.[][]; .text | startswith("dispatched: runtime=claude"))' <<<"$comments" >/dev/null && command -v claude >/dev/null; then
  sessions=$(perl -e 'alarm shift; exec @ARGV' 20 claude agents --json </dev/null 2>/dev/null | jq -c '[.[].id | select(. != null)] | select(length > 0)' 2>/dev/null) || sessions=null
fi
pids=$(jq -r '.[][] | select(.text | startswith("dispatched: runtime=cmd")) | .text | capture("session=pid-(?<p>[0-9]+)").p' <<<"$comments" | sort -u |
  while read -r pid; do if kill -0 "$pid" 2>/dev/null; then echo "$pid"; fi; done | jq -Rn '[inputs]')

jq -n --argjson stale_minutes "$stale_minutes" --argjson in_progress "$in_progress" --argjson blocked "$blocked" \
  --argjson ready "$ready" --argjson human "$human" --argjson review "$review" --argjson comments "$comments" \
  --argjson sessions "${sessions:-null}" --argjson pids "$pids" '
  def ts: sub("\\.[0-9]+"; "") | fromdateiso8601;
  def labeled($l): (.labels // []) | index($l) != null;
  def thread: $comments[.id] // [];
  def brief: if . then {author, text, created_at} else null end;
  now as $now
  | ($blocked // [] | map({key: .id, value: .blocked_by}) | from_entries) as $by
  | [ ($in_progress // [])[]
      | select(labeled("needs-review") | not)
      | . as $i
      | (thread | last | brief) as $c
      | ([$i.updated_at, $c.created_at] | map(select(. != null) | ts) | max) as $t
      | ([thread[] | select(.author == $i.assignee and (.text | startswith("dispatched: "))) | .text] | first // "") as $launch
      | ($launch | capture("runtime=(?<v>[^ ]+)").v // null) as $runtime
      | ($launch | capture("session=(?<v>[^ ]+)").v // null) as $session
      | { id, title, assignee, runtime: $runtime, session: $session,
          alive: (if $runtime == "cmd" then ($pids | index($session | ltrimstr("pid-")) != null)
                  elif $runtime == "claude" and $sessions != null then ($sessions | index($session) != null)
                  else null end),
          last_activity: ($t | todateiso8601),
          idle_minutes: ((($now - $t) / 60) | floor),
          last_comment: $c,
          blocked_by: ($by[$i.id] // []) } ] as $running
  | {
      now: ($now | floor | todateiso8601),
      stale_minutes: $stale_minutes,
      running: $running,
      dead: ($running | map(select(.alive == false) | {id, title, assignee})),
      pause: ($running | map(select(.alive != false and (.blocked_by | length > 0)) | {id, title, assignee, blocked_by})),
      stale: ($running | map(select(.alive != false and .idle_minutes >= $stale_minutes) | {id, title, assignee, last_activity, idle_minutes})),
      review: [ ($review // [])[] | {id, title, status, assignee: (.assignee // null), delegated: labeled("reviewing"), last_comment: (thread | last | brief)} ],
      ready: [ ($ready // [])[]
               | select(.status == "open" and (.assignee // "") == "" and (labeled("needs-human") or labeled("needs-review") | not))
               | {id, title, priority} ],
      waiting: [ ($blocked // [])[] | select(.status == "open") | {id, title, blocked_by} ],
      needs_human: [ ($human // [])[]
                     | {id, title, status, assignee: (.assignee // null),
                        question: ([thread[] | select(.text | startswith("needs-human:"))] | last // (thread | last) | brief)} ]
    }'
