#!/usr/bin/env bash
set -euo pipefail

mise install
bash .cursor/scripts/seed-mergify-auth.sh

export VP_NODE_MANAGER=yes
curl -fsSL https://vite.plus | bash
# shellcheck disable=SC1091
. "${HOME}/.config/vite-plus/env"
vp env pin 26.9.0
vp install

if [ ! -x .vite-hooks/_/pre-push ]; then
  vp hooks enable
fi
