#!/usr/bin/env bash
set -euo pipefail

token="${MERGIFY_USER_TOKEN:-}"
if [[ -z "${token}" ]]; then
  exit 0
fi

expires_at="${MERGIFY_USER_TOKEN_EXPIRES_AT:-2027-09-18T06:52:38.855091Z}"
payload="$(MERGIFY_USER_TOKEN="$token" MERGIFY_USER_TOKEN_EXPIRES_AT="$expires_at" python3 - <<'PY'
import json, os
print(json.dumps({
  "https://api.mergify.com": {
    "token": os.environ["MERGIFY_USER_TOKEN"],
    "expires_at": os.environ["MERGIFY_USER_TOKEN_EXPIRES_AT"],
  }
}))
PY
)"

write_creds() {
  local dir="$1"
  mkdir -p "$dir"
  umask 077
  printf '%s\n' "$payload" >"$dir/credentials.json"
  chmod 600 "$dir/credentials.json"
}

if [[ "$(uname -s)" == "Darwin" ]]; then
  write_creds "${HOME}/Library/Application Support/mergify"
fi
write_creds "${XDG_CONFIG_HOME:-${HOME}/.config}/mergify"
