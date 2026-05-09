import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { db } from '$lib/server/db';
import { isAuthorizedBackup } from '$lib/server/backup-auth';

const TABLES = [
	'seasons',
	'people',
	'metrics',
	'entries',
	'entry_audit',
	'goals',
	'achievements',
	'countries_visited'
] as const;

export const GET: RequestHandler = async ({ request, url, locals }) => {
	if (locals.role !== 'admin' && !isAuthorizedBackup(url, request.headers.get('authorization'))) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const dbPath = process.env.DB_PATH || './data/resolution-recap.db';
	const tempFile = `/tmp/backup-${randomBytes(8).toString('hex')}.db`;

	try {
		// Create SQLite backup to temp file
		try {
			execSync(`sqlite3 "${dbPath}" ".backup '${tempFile}'"`, { stdio: 'pipe' });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return json(
				{ error: 'sqlite3 not available or backup failed', detail: message },
				{ status: 500 }
			);
		}

		// Read and gzip the backup
		const rawBuffer = readFileSync(tempFile);
		const gzipped = gzipSync(rawBuffer);

		// Compute row counts from the original db
		const counts: string[] = [];
		for (const table of TABLES) {
			try {
				const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
				counts.push(`${table}=${row.c}`);
			} catch {
				counts.push(`${table}=error`);
			}
		}
		const rowCountHeader = counts.join(',');

		const date = new Date().toISOString().split('T')[0];

		return new Response(new Uint8Array(gzipped), {
			status: 200,
			headers: {
				'Content-Type': 'application/gzip',
				'Content-Disposition': `attachment; filename="db-${date}.db.gz"`,
				'X-Backup-Row-Counts': rowCountHeader
			}
		});
	} finally {
		// Clean up temp SQLite file and WAL/SHM sidecars
		for (const suffix of ['', '-wal', '-shm']) {
			const f = tempFile + suffix;
			if (existsSync(f)) {
				try {
					unlinkSync(f);
				} catch {
					// best-effort cleanup
				}
			}
		}
	}
};
