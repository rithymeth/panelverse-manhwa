#!/usr/bin/env bash
# Panelverse — first-time GitHub publish (macOS / Linux)
set -euo pipefail
cd "$(dirname "$0")"
remote='https://github.com/rithymeth/panelverse-manhwa.git'
command -v git >/dev/null || { echo 'Install Git first.' >&2; exit 1; }
if [[ ! -d .git ]]; then git init; fi
git branch -M main
git add -A
if ! git diff --cached --quiet; then
  git commit -m 'Build Panelverse manhwa publishing and reading website'
fi
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$remote"
elif [[ "$(git remote get-url origin)" != "$remote" ]]; then
  echo 'Existing origin differs; refusing to overwrite it.' >&2
  exit 1
fi
git push -u origin main
echo "Published: https://github.com/rithymeth/panelverse-manhwa"
