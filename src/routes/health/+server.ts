import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const checks: Record<string, { status: string; message?: string; duration?: number }> = {};
	let overallStatus = 'ok';

	// Check 1: Basic server response
	checks.server = { status: 'ok' };

	// Check 2: Database connection
	const dbStart = Date.now();
	try {
		const { db } = await import('$lib/server/db');
		const test = db.prepare('SELECT 1 as ok').get() as { ok: number };
		
		if (test?.ok === 1) {
			checks.database = { 
				status: 'ok', 
				duration: Date.now() - dbStart 
			};
		} else {
			checks.database = { 
				status: 'error', 
				message: 'Unexpected query result',
				duration: Date.now() - dbStart 
			};
			overallStatus = 'degraded';
		}
	} catch (error) {
		checks.database = { 
			status: 'error', 
			message: error instanceof Error ? error.message : 'Unknown error',
			duration: Date.now() - dbStart 
		};
		overallStatus = 'error';
	}

	// Check 3: Environment variables
	const requiredEnvVars = ['NODE_ENV', 'PORT', 'HOST', 'DB_PATH'];
	const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
	
	if (missingEnvVars.length > 0) {
		checks.environment = { 
			status: 'warning', 
			message: `Missing: ${missingEnvVars.join(', ')}` 
		};
		if (overallStatus === 'ok') overallStatus = 'degraded';
	} else {
		checks.environment = { status: 'ok' };
	}

	// Check 4: Memory usage
	const memUsage = process.memoryUsage();
	const memoryMB = Math.round(memUsage.heapUsed / 1024 / 1024);
	checks.memory = { 
		status: memoryMB > 400 ? 'warning' : 'ok',
		message: `${memoryMB}MB heap used`
	};

	const statusCode = overallStatus === 'error' ? 503 : 200;

	return json({
		status: overallStatus,
		timestamp: new Date().toISOString(),
		uptime: Math.round(process.uptime()),
		version: process.env.npm_package_version || 'unknown',
		environment: process.env.NODE_ENV || 'development',
		checks
	}, { status: statusCode });
};
