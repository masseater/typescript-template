#!/usr/bin/env bash
set -euo pipefail
if [ -z "${GITHUB_APP_TOKEN:-}" ]; then
  echo "::error::credentials.masseater.dev issued no GitHub App token; an update with GITHUB_TOKEN leaves the up-to-date check waiting for approval"
  exit 1
fi
export GH_TOKEN="$GITHUB_APP_TOKEN"
gh pr list --repo "$GITHUB_REPOSITORY" --state open --json number,autoMergeRequest,mergeStateStatus \
  --jq '.[] | select(.autoMergeRequest != null and .mergeStateStatus == "BEHIND") | .number' |
  while read -r number; do
    gh pr update-branch "$number" --repo "$GITHUB_REPOSITORY" ||
      echo "::warning::Could not update pull request #$number"
  done
