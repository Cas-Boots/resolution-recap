import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (locals.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const debug: Record<string, unknown> = {
		timestamp: new Date().toISOString(),
		node: {
			version: process.version,
			platform: process.platform,
			arch: process.arch,
			pid: process.pid,
			uptime: process.uptime()
		},
		environment: {
			NODE_ENV: process.env.NODE_ENV,
			PORT: process.env.PORT,
			HOST: process.env.HOST,
			ORIGIN: process.env.ORIGIN,
			DB_PATH: process.env.DB_PATH
		},
		memory: {
			heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
			heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
			rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
		}
	};

	try {
		const { db } = await import('$lib/server/db');
		const tables = db.prepare(`
			SELECT name FROM sqlite_master
			WHERE type='table'
			ORDER BY name
		`).all() as { name: string }[];
		debug.database = { status: 'connected', tableCount: tables.length };
	} catch {
		debug.database = { status: 'error' };
	}

	return json(debug, { headers: { 'Cache-Control': 'no-store' } });
};
