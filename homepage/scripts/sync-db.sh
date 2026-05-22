#!/usr/bin/env bash
#
# Sync local MongoDB → remote server
#
# Usage:
#   ./scripts/sync-db.sh                     # Full sync (all collections)
#   ./scripts/sync-db.sh posts pages media   # Only sync specific collections
#
# Environment variables (or edit defaults below):
#   LOCAL_CONTAINER   - local mongo docker container name  (default: mongodb)
#   LOCAL_DB          - local database name                (default: goplantatree)
#   REMOTE_HOST       - SSH host of the server             (required)
#   REMOTE_CONTAINER  - remote mongo docker container name (default: goplantatree-mongo)
#   REMOTE_DB         - remote database name               (default: goplantatree)
#
# The script:
#   1. Runs mongodump inside the local container
#   2. Copies the dump to the remote server via SSH
#   3. Runs mongorestore --drop inside the remote container
#   4. Cleans up temp files
#
set -euo pipefail

# --- Configuration ---
LOCAL_CONTAINER="${LOCAL_CONTAINER:-mongodb}"
LOCAL_DB="${LOCAL_DB:-goplantatree}"
LOCAL_AUTH="${LOCAL_AUTH:---username admin --password password --authenticationDatabase admin}"
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_CONTAINER="${REMOTE_CONTAINER:-goplantatree-mongo}"
REMOTE_DB="${REMOTE_DB:-goplantatree}"
DUMP_DIR="/tmp/mongodump-goplantatree"

# --- Argument handling ---
COLLECTIONS=("$@")

if [[ -z "$REMOTE_HOST" ]]; then
    echo "❌ REMOTE_HOST is not set. Usage:"
    echo "   REMOTE_HOST=user@server ./scripts/sync-db.sh [collection...]"
    exit 1
fi

echo "🔄 MongoDB Sync: local ($LOCAL_CONTAINER/$LOCAL_DB) → remote ($REMOTE_HOST/$REMOTE_CONTAINER/$REMOTE_DB)"

# --- Step 1: Dump local database ---
echo ""
echo "📦 Step 1: Dumping local database..."

# Clean up previous dump
docker exec "$LOCAL_CONTAINER" rm -rf "$DUMP_DIR" 2>/dev/null || true

if [[ ${#COLLECTIONS[@]} -gt 0 ]]; then
    echo "   Collections: ${COLLECTIONS[*]}"
    DUMP_ARGS=""
    for col in "${COLLECTIONS[@]}"; do
        DUMP_ARGS="$DUMP_ARGS --collection $col"
    done
    docker exec "$LOCAL_CONTAINER" mongodump \
        $LOCAL_AUTH \
        --db "$LOCAL_DB" \
        $DUMP_ARGS \
        --out "$DUMP_DIR"
else
    echo "   All collections"
    docker exec "$LOCAL_CONTAINER" mongodump \
        $LOCAL_AUTH \
        --db "$LOCAL_DB" \
        --out "$DUMP_DIR"
fi

echo "   ✅ Dump complete"

# Stream dump directly from container to remote (avoids docker cp Snap issues)
echo ""
echo "📤 Step 2: Transferring to remote server..."

ssh "$REMOTE_HOST" "mkdir -p /tmp/mongodump-restore"
docker exec "$LOCAL_CONTAINER" tar -czf - -C "$DUMP_DIR" "$LOCAL_DB" \
    | ssh "$REMOTE_HOST" "cat > /tmp/mongodump-restore/dump.tar.gz"
echo "   ✅ Transferred to $REMOTE_HOST"

# --- Step 3: Restore on remote ---
echo ""
echo "📥 Step 3: Restoring on remote server..."

ssh "$REMOTE_HOST" bash -s "$REMOTE_CONTAINER" "$REMOTE_DB" <<'REMOTE_SCRIPT'
    CONTAINER="$1"
    DB="$2"
    
    # Unpack on the host
    cd /tmp/mongodump-restore
    tar -xzf dump.tar.gz
    
    # Copy into the container
    docker cp "/tmp/mongodump-restore/$DB" "$CONTAINER:/tmp/mongorestore-data"
    
    # Restore with --drop (replaces existing data)
    docker exec "$CONTAINER" mongorestore \
        --db "$DB" \
        --drop \
        "/tmp/mongorestore-data"
    
    # Cleanup
    docker exec "$CONTAINER" rm -rf /tmp/mongorestore-data
    rm -rf /tmp/mongodump-restore
    
    echo "   ✅ Restore complete"
REMOTE_SCRIPT

# --- Step 4: Cleanup ---
echo ""
echo "🧹 Step 4: Cleaning up..."
docker exec "$LOCAL_CONTAINER" rm -rf "$DUMP_DIR" 2>/dev/null || true

echo ""
echo "✅ Sync complete!"
if [[ ${#COLLECTIONS[@]} -gt 0 ]]; then
    echo "   Collections synced: ${COLLECTIONS[*]}"
else
    echo "   All collections synced"
fi

