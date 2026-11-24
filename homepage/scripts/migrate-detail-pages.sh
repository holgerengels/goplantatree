#!/usr/bin/env bash
#
# Run detail & list pages migration inside the app docker container.
#
# Usage (local / dev):
#   ./scripts/migrate-detail-pages.sh
#   CONTAINER=goplantatree-app ./scripts/migrate-detail-pages.sh
#
# Usage (remote / prod):
#   ./scripts/migrate-detail-pages.sh user@server
#   REMOTE_HOST=user@server ./scripts/migrate-detail-pages.sh
#
set -euo pipefail

CONTAINER="${CONTAINER:-goplantatree-app}"
REMOTE_HOST="${REMOTE_HOST:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_FILE="$SCRIPT_DIR/migrate-detail-pages.js"

if [[ $# -gt 0 ]]; then
    if [[ "$1" == *"@"* || "$1" == *"."* ]]; then
        REMOTE_HOST="$1"
        shift
        if [[ $# -gt 0 ]]; then
            CONTAINER="$1"
            shift
        fi
    else
        CONTAINER="$1"
        shift
    fi
fi

if [[ -n "$REMOTE_HOST" ]]; then
    echo "🚀 Running migration on remote server ($REMOTE_HOST) in container ($CONTAINER)..."
    ssh "$REMOTE_HOST" "docker exec -i $CONTAINER node --input-type=module -" < "$SCRIPT_FILE"
else
    echo "🚀 Running migration locally in container ($CONTAINER)..."
    docker exec -i "$CONTAINER" node --input-type=module - < "$SCRIPT_FILE"
fi
