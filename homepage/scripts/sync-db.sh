#!/usr/bin/env bash
#
# Sync remote MongoDB → local server
#
# Usage:
#   Option A: REMOTE_HOST=user@server ./scripts/sync-db.sh [collection...]
#   Option B: ./scripts/sync-db.sh user@server [collection...]
#
# Environment variables (or edit defaults below):
#   LOCAL_CONTAINER   - local mongo docker container name  (default: mongodb)
#   LOCAL_DB          - local database name                (default: goplantatree)
#   LOCAL_AUTH        - local mongo authentication args    (default auth provided)
#   REMOTE_HOST       - SSH host of the server             (optional if passed as param)
#   REMOTE_CONTAINER  - remote mongo docker container name (default: goplantatree-mongo)
#   REMOTE_DB         - remote database name               (default: goplantatree)
#   REMOTE_AUTH       - remote mongo authentication args    (default: empty)
#
set -euo pipefail

# --- Configuration ---
LOCAL_CONTAINER="${LOCAL_CONTAINER:-mongodb}"
LOCAL_DB="${LOCAL_DB:-goplantatree}"
LOCAL_AUTH="${LOCAL_AUTH:---username admin --password password --authenticationDatabase admin}"
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_CONTAINER="${REMOTE_CONTAINER:-goplantatree-mongo}"
REMOTE_DB="${REMOTE_DB:-goplantatree}"
REMOTE_AUTH="${REMOTE_AUTH:-}"
DUMP_DIR="/tmp/mongodump-goplantatree"

# --- Argument handling ---
COLLECTIONS=()
if [[ $# -gt 0 ]]; then
    # If the first argument contains '@' or looks like an IP/domain, treat it as REMOTE_HOST
    if [[ "$1" == *"@"* || "$1" == *"."* ]]; then
        REMOTE_HOST="$1"
        shift
    fi
    COLLECTIONS=("$@")
fi

if [[ -z "$REMOTE_HOST" ]]; then
    echo "❌ REMOTE_HOST is not set. Usage:"
    echo "   Option A: REMOTE_HOST=user@server ./scripts/sync-db.sh [collection...]"
    echo "   Option B: ./scripts/sync-db.sh user@server [collection...]"
    exit 1
fi

echo "🔄 MongoDB Sync: remote ($REMOTE_HOST/$REMOTE_CONTAINER/$REMOTE_DB) → local ($LOCAL_CONTAINER/$LOCAL_DB)"

# --- Step 1: Dump remote database ---
echo ""
echo "📦 Step 1: Dumping remote database..."

# Clean up previous dump inside remote container
ssh "$REMOTE_HOST" "docker exec $REMOTE_CONTAINER rm -rf $DUMP_DIR 2>/dev/null || true"

if [[ ${#COLLECTIONS[@]} -gt 0 ]]; then
    echo "   Collections: ${COLLECTIONS[*]}"
    DUMP_ARGS=""
    for col in "${COLLECTIONS[@]}"; do
        DUMP_ARGS="$DUMP_ARGS --collection $col"
    done
    ssh "$REMOTE_HOST" "docker exec $REMOTE_CONTAINER mongodump \
        $REMOTE_AUTH \
        --db $REMOTE_DB \
        $DUMP_ARGS \
        --out $DUMP_DIR"
else
    echo "   All collections"
    ssh "$REMOTE_HOST" "docker exec $REMOTE_CONTAINER mongodump \
        $REMOTE_AUTH \
        --db $REMOTE_DB \
        --out $DUMP_DIR"
fi

echo "   ✅ Remote dump complete"

# --- Step 2: Stream dump from remote container to local container ---
echo ""
echo "📥 Step 2: Streaming dump to local container..."

# Clean up and recreate temp restore directory inside local container
docker exec "$LOCAL_CONTAINER" rm -rf /tmp/mongorestore-data 2>/dev/null || true
docker exec "$LOCAL_CONTAINER" mkdir -p /tmp/mongorestore-data

# Stream over SSH and extract directly inside the local container
ssh "$REMOTE_HOST" "docker exec $REMOTE_CONTAINER tar -czf - -C $DUMP_DIR $REMOTE_DB" \
    | docker exec -i "$LOCAL_CONTAINER" tar -xzf - -C /tmp/mongorestore-data

echo "   ✅ Transferred and unpacked in local container"

# --- Step 3: Restore locally ---
echo ""
echo "📤 Step 3: Restoring to local database..."

docker exec "$LOCAL_CONTAINER" mongorestore \
    $LOCAL_AUTH \
    --db "$LOCAL_DB" \
    --drop \
    "/tmp/mongorestore-data/$REMOTE_DB"

echo "   ✅ Local restore complete"

# --- Step 4: Cleanup ---
echo ""
echo "🧹 Step 4: Cleaning up temp files..."
ssh "$REMOTE_HOST" "docker exec $REMOTE_CONTAINER rm -rf $DUMP_DIR 2>/dev/null || true"
docker exec "$LOCAL_CONTAINER" rm -rf /tmp/mongorestore-data 2>/dev/null || true

echo ""
echo "✅ Sync complete!"
if [[ ${#COLLECTIONS[@]} -gt 0 ]]; then
    echo "   Collections synced: ${COLLECTIONS[*]}"
else
    echo "   All collections synced"
fi
