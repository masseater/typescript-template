#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

bash .cursor/scripts/seed-mergify-auth.sh

if [ -f "${HOME}/.config/vite-plus/env" ]; then
  # shellcheck disable=SC1091
  . "${HOME}/.config/vite-plus/env"
fi

hooks_path="$(git config --get core.hooksPath || true)"
vite_hooks="$(pwd)/.vite-hooks/_"

if [ ! -x "${vite_hooks}/pre-push" ]; then
  if [ -n "${hooks_path}" ] && [[ "${hooks_path}" == *agent-hooks* ]]; then
    git config --unset-all core.hooksPath || true
    vp hooks enable
    git config core.hooksPath "${hooks_path}"
  else
    vp hooks enable
  fi
fi

hooks_path="$(git config --get core.hooksPath || true)"
if [ -z "${hooks_path}" ] || [ ! -f "${hooks_path}/.dispatcher" ]; then
  exit 0
fi

test -x "${vite_hooks}/pre-push"

printf '%s\n' "${vite_hooks}" >"${hooks_path}/.cursor-original-hooks-path"
ln -sfn .dispatcher "${hooks_path}/pre-push"
test -e "${hooks_path}/pre-push"
