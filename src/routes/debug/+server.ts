import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Only allow in development or with a secret key
const ALLOWED = process.env.NODE_ENV !== 'production' || process.env.DEBUG_SECRET;

export const GET: RequestHandler = async ({ url }) => {
	// In production, require a secret key
	if (process.env.NODE_ENV === 'production') {
		const secret = url.searchParams.get('secret');
		if (!secret || secret !== process.env.DEBUG_SECRET) {
			throw error(403, 'Forbidden');
		}
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
			DB_PATH: process.env.DB_PATH,
			PROTOCOL_HEADER: process.env.PROTOCOL_HEADER,
			HOST_HEADER: process.env.HOST_HEADER,
			// Log all env vars that aren't secrets (for debugging)
			allEnvKeys: Object.keys(process.env).filter(k => 
				!k.includes('SECRET') && 
				!k.includes('PASSWORD') && 
				!k.includes('KEY') &&
				!k.includes('TOKEN')
			)
		},
		memory: {
			heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
			heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
			rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
		},
		cwd: process.cwd(),
		execPath: process.execPath
	};

	// Test database
	try {
		const { db } = await import('$lib/server/db');
		const tables = db.prepare(`
			SELECT name FROM sqlite_master 
			WHERE type='table' 
			ORDER BY name
		`).all() as { name: string }[];
		
		debug.database = {
			status: 'connected',
			tables: tables.map(t => t.name),
			path: process.env.DB_PATH
		};
	} catch (e) {
		debug.database = {
			status: 'error',
			error: e instanceof Error ? e.message : 'Unknown error',
			stack: e instanceof Error ? e.stack : undefined
		};
	}

	// Test routes
	try {
		// This will help debug if SvelteKit routes are properly loaded
		debug.routes = {
			note: 'Check server logs for route registration'
		};
	} catch (e) {
		debug.routes = { error: e instanceof Error ? e.message : 'Unknown error' };
	}

	return json(debug, { 
		status: 200,
		headers: {
			'Cache-Control': 'no-store'
		}
	});
};
