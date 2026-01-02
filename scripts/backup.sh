#!/bin/bash
# Backup script for Resolution Recap database

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_PATH="${DB_PATH:-./data/resolution-recap.db}"
MAX_BACKUPS="${MAX_BACKUPS:-10}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/resolution-recap_$TIMESTAMP.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database not found at $DB_PATH"
    exit 1
fi

# Create backup using SQLite's backup command (safe for running database)
echo "Creating backup of $DB_PATH..."
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

if [ $? -eq 0 ]; then
    # Compress the backup
    gzip "$BACKUP_FILE"
    echo "Backup created: ${BACKUP_FILE}.gz"
    
    # Calculate size
    SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
    echo "Backup size: $SIZE"
    
    # Remove old backups (keep only MAX_BACKUPS)
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.gz 2>/dev/null | wc -l)
    if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
        echo "Cleaning up old backups (keeping last $MAX_BACKUPS)..."
        ls -1t "$BACKUP_DIR"/*.gz | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f
    fi
    
    echo "Backup completed successfully!"
else
    echo "Error: Backup failed!"
    exit 1
fi
