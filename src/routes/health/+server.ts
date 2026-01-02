import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		// Import db lazily to test database connection
		const { db } = await import('$lib/server/db');
		
		// Simple query to verify database is working
		const test = db.prepare('SELECT 1 as ok').get() as { ok: number };
		
		if (test?.ok !== 1) {
			return json({ status: 'error', message: 'Database check failed' }, { status: 503 });
		}

		return json({
			status: 'ok',
			timestamp: new Date().toISOString(),
			uptime: process.uptime()
		});
	} catch (error) {
		console.error('Health check failed:', error);
		return json({
			status: 'error',
			message: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 503 });
	}
};
