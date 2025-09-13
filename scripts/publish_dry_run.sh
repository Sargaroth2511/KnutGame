#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

# Preview deployment without making any remote changes
# - Skips builds
# - Shows rsync/ssh actions

# Resolve this script's directory so it works from any CWD
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "$SCRIPT_DIR/publish_to_server.sh" \
  --host bitsbybeier.de \
  --port 2500 \
  --user johannes \
  --dry-run
