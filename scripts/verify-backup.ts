#!/usr/bin/env npx tsx
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';

const CORE_TABLES = ['seasons', 'people', 'metrics', 'entries'] as const;
const ALL_TABLES = ['seasons', 'people', 'metrics', 'entries', 'entry_audit', 'goals', 'achievements', 'countries_visited'] as const;

function main() {
    const [jsonPath, sqlitePath] = process.argv.slice(2);

    if (!jsonPath || !sqlitePath) {
        console.error('Usage: verify-backup.ts <json-path> <sqlite-path>');
        process.exit(1);
    }

    // Parse JSON backup
    let jsonData: Record<string, unknown[]>;
    try {
        jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'));
    } catch (err) {
        console.error(`Failed to parse JSON backup: ${err}`);
        process.exit(1);
    }

    // Open SQLite snapshot (read-only)
    let db: InstanceType<typeof Database>;
    try {
        db = new Database(sqlitePath, { readonly: true });
    } catch (err) {
        console.error(`Failed to open SQLite snapshot: ${err}`);
        process.exit(1);
    }

    // Compare counts
    const failures: string[] = [];

    console.log('\nBackup verification:');
    console.log('Table'.padEnd(25) + 'SQLite'.padEnd(10) + 'JSON'.padEnd(10) + 'Status');
    console.log('-'.repeat(55));

    for (const table of ALL_TABLES) {
        const sqliteCount = (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
        const jsonArr = Array.isArray(jsonData[table]) ? jsonData[table] as unknown[] : [];
        const jsonCount = jsonArr.length;

        const isCoreTable = (CORE_TABLES as readonly string[]).includes(table);
        let status = 'OK';

        if (sqliteCount !== jsonCount) {
            status = 'MISMATCH';
            failures.push(`${table}: SQLite=${sqliteCount}, JSON=${jsonCount}`);
        } else if (isCoreTable && sqliteCount === 0) {
            status = 'EMPTY';
            failures.push(`${table}: core table is empty`);
        }

        console.log(table.padEnd(25) + String(sqliteCount).padEnd(10) + String(jsonCount).padEnd(10) + status);
    }

    console.log();

    if (failures.length > 0) {
        console.error('VERIFICATION FAILED:');
        for (const f of failures) {
            console.error(`  - ${f}`);
        }
        process.exit(1);
    }

    console.log('All checks passed.');
    db.close();
}

main();
