#!/usr/bin/env sh
# macOS / Linux helper: install, build and print the config snippets.
set -e
cd "$(dirname "$0")/.."
node -v
npm install
npm run build
node dist/index.js print-config
