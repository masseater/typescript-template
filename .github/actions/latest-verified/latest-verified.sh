#!/usr/bin/env bash
set -euo pipefail
workflow="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID" --jq .workflow_id)"
newer="$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/$workflow/runs?branch=$GITHUB_REF_NAME&event=push&per_page=100" \
  --jq ".workflow_runs[] | select(.run_number > $GITHUB_RUN_NUMBER) | .id")"
for run in $newer; do
  if [ -n "$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run/jobs?per_page=100" \
    --jq '.jobs[] | select(.name == env.VERIFY_JOB and .conclusion == "success") | .id')" ]; then
    echo "run $run of a newer push passed $VERIFY_JOB and supersedes this one"
    exit 0
  fi
done
echo "latest=true" >>"$GITHUB_OUTPUT"
