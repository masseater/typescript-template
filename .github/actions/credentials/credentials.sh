#!/usr/bin/env bash
set -euo pipefail
audience="masseater-dev-credential-broker"
oidc="$(curl -fsS -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
  "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=$audience" | jq -er .value)"
echo "::add-mask::$oidc"
response="$(curl -fsS --retry 3 -X POST -H "Authorization: Bearer $oidc" "https://credentials.masseater.dev/")"
jq -r '.[] | "::add-mask::\(.)"' <<<"$response"
jq -r '{
  OPENROUTER_API_KEY: .openrouterApiKey,
  CLAUDE_CODE_OAUTH_TOKEN: .claudeCodeOauthToken,
  CLOUDFLARE_API_TOKEN: .token,
  CLOUDFLARE_ACCOUNT_ID: .accountId
} | to_entries[] | select(.value != null) | "\(.key)=\(.value)"' <<<"$response" >>"$GITHUB_ENV"
