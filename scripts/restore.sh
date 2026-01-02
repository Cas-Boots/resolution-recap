#!/bin/bash
# Restore script for Resolution Recap database

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_PATH="${DB_PATH:-./data/resolution-recap.db}"

# Check arguments
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.gz>"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null || echo "  No backups found in $BACKUP_DIR"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    # Try with backup directory prefix
    BACKUP_FILE="$BACKUP_DIR/$1"
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "Error: Backup file not found: $1"
        exit 1
    fi
fi

echo "WARNING: This will replace the current database with the backup!"
echo "Current database: $DB_PATH"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Create a backup of current database first
if [ -f "$DB_PATH" ]; then
    CURRENT_BACKUP="$DB_PATH.pre-restore-$(date +%Y%m%d_%H%M%S)"
    echo "Backing up current database to $CURRENT_BACKUP..."
    cp "$DB_PATH" "$CURRENT_BACKUP"
fi

# Stop any processes using the database (in Docker context)
echo "Restoring database..."

# Decompress and restore
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" > "$DB_PATH.tmp"
else
    cp "$BACKUP_FILE" "$DB_PATH.tmp"
fi

# Verify the restored database
sqlite3 "$DB_PATH.tmp" "SELECT COUNT(*) FROM seasons;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    # Remove old database files
    rm -f "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm"
    # Move new database in place
    mv "$DB_PATH.tmp" "$DB_PATH"
    echo "Database restored successfully!"
    echo ""
    echo "Database stats:"
    sqlite3 "$DB_PATH" "SELECT 'Seasons: ' || COUNT(*) FROM seasons;"
    sqlite3 "$DB_PATH" "SELECT 'People: ' || COUNT(*) FROM people;"
    sqlite3 "$DB_PATH" "SELECT 'Entries: ' || COUNT(*) FROM entries;"
else
    echo "Error: Restored database appears to be corrupt!"
    rm -f "$DB_PATH.tmp"
    exit 1
fi
