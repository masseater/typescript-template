#!/usr/bin/env bash
set -euo pipefail
if [ "$(git rev-parse HEAD)" = "$HEAD_SHA" ]; then
  echo "::error::Claude did not commit a fix"
  exit 1
fi
if [ -z "${GITHUB_APP_TOKEN:-}" ]; then
  echo "::error::credentials.masseater.dev issued no GitHub App token; a push with GITHUB_TOKEN leaves the up-to-date check waiting for approval"
  exit 1
fi
export GH_TOKEN="$GITHUB_APP_TOKEN"
gh auth setup-git
git push --no-verify origin "HEAD:refs/heads/$BRANCH"
if [ "$BRANCH" = "$HEAD_BRANCH" ]; then
  exit 0
fi
gh pr list --repo "$GITHUB_REPOSITORY" --state open --json number,headRefName \
  --jq '.[] | select(.headRefName | startswith("claude/fix-verify-")) | .number' |
  while read -r superseded; do
    gh pr close "$superseded" --repo "$GITHUB_REPOSITORY" --delete-branch \
      --comment "Superseded by the fix for $FAILED_RUN_URL"
  done
url="$(gh pr create --base "$DEFAULT_BRANCH" --head "$BRANCH" \
  --title "$(git log -1 --format=%s)" \
  --body "Fixes verify failure $FAILED_RUN_URL")"
gh pr merge "$url" --squash --auto --delete-branch
