#!/bin/bash
# Restore data from a GitHub backup JSON file
# Usage: ./scripts/restore-from-backup.sh <backup-file.json> [APP_URL] [BACKUP_TOKEN]

set -e

BACKUP_FILE=$1
APP_URL=${2:-$APP_URL}
BACKUP_TOKEN=${3:-$BACKUP_TOKEN}
MODE=${4:-merge}

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file.json> [APP_URL] [BACKUP_TOKEN] [mode]"
    echo ""
    echo "Arguments:"
    echo "  backup-file.json  Path to the backup JSON file"
    echo "  APP_URL           Application URL (or set APP_URL env var)"
    echo "  BACKUP_TOKEN      Backup token (or set BACKUP_TOKEN env var)"
    echo "  mode              'merge' (default) or 'replace'"
    echo ""
    echo "Examples:"
    echo "  $0 backups/backup-2026-01-02.json https://myapp.com/snapvrienden-r3c4p my-secret-token"
    echo "  APP_URL=https://myapp.com BACKUP_TOKEN=secret $0 backups/backup-2026-01-02.json"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

if [ -z "$APP_URL" ]; then
    echo "❌ APP_URL is required"
    exit 1
fi

if [ -z "$BACKUP_TOKEN" ]; then
    echo "❌ BACKUP_TOKEN is required"
    exit 1
fi

echo "📦 Restoring from: $BACKUP_FILE"
echo "🌐 Target: $APP_URL"
echo "📝 Mode: $MODE"
echo ""

# Validate JSON before sending
if ! python3 -m json.tool "$BACKUP_FILE" > /dev/null 2>&1; then
    echo "❌ Invalid JSON in backup file"
    exit 1
fi

echo "⏳ Sending data to import endpoint..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${APP_URL}/api/import?token=${BACKUP_TOKEN}&mode=${MODE}" \
    -H "Content-Type: application/json" \
    -d @"$BACKUP_FILE")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Import successful!"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo "❌ Import failed with HTTP $HTTP_CODE"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    exit 1
fi
