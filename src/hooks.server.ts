import type { Handle, HandleServerError } from '@sveltejs/kit';
import os from 'os';
import { verifyRole } from '$lib/server/auth';

// Log network interfaces at startup
function logNetworkInterfaces() {
	const interfaces = os.networkInterfaces();
	console.log('🌐 Network interfaces:');
	for (const [name, addrs] of Object.entries(interfaces)) {
		if (!addrs) continue;
		for (const addr of addrs) {
			if (addr.internal) continue; // Skip loopback
			console.log(`   ${name}: ${addr.address} (${addr.family})`);
		}
	}
	// Also log loopback for debugging
	const loopback = interfaces['lo'] || interfaces['lo0'];
	if (loopback) {
		console.log('   Loopback:');
		for (const addr of loopback) {
			console.log(`     ${addr.address} (${addr.family})`);
		}
	}
}

// Startup logging
console.log('═══════════════════════════════════════════════════');
console.log('🚀 Starting Resolution Recap server...');
console.log('═══════════════════════════════════════════════════');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('📍 DB_PATH:', process.env.DB_PATH || './data/resolution-recap.db');
console.log('📍 HOST:', process.env.HOST || 'localhost');
console.log('📍 PORT:', process.env.PORT || '5173');
console.log('📍 ORIGIN:', process.env.ORIGIN || '(not set)');
logNetworkInterfaces();
console.log('═══════════════════════════════════════════════════');

// Test database connection on startup
let dbInitialized = false;
let dbError: Error | null = null;

async function initializeDatabase() {
	try {
		console.log('🗄️  Testing database connection...');
		const { db } = await import('$lib/server/db');
		
		// This will trigger lazy initialization
		const test = db.prepare('SELECT 1 as ok').get() as { ok: number };
		
		if (test?.ok === 1) {
			console.log('✅ Database connection verified');
			dbInitialized = true;
		} else {
			throw new Error('Database query returned unexpected result');
		}
	} catch (error) {
		dbError = error as Error;
		console.error('❌ Database connection failed:', error);
		console.error('Stack trace:', (error as Error).stack);
	}
}

// Initialize database immediately
initializeDatabase().then(() => {
	console.log('═══════════════════════════════════════════════════');
	if (dbInitialized) {
		console.log('✅ Server initialization complete - ready for requests');
	} else {
		console.log('⚠️  Server started but database initialization failed');
		console.log('⚠️  Some features may not work correctly');
	}
	console.log('═══════════════════════════════════════════════════');
}).catch((err) => {
	console.error('❌ Critical error during initialization:', err);
});

export const handle: Handle = async ({ event, resolve }) => {
	const startTime = Date.now();
	const requestId = crypto.randomUUID().slice(0, 8);
	
	// Log incoming request
	if (process.env.NODE_ENV === 'production') {
		console.log(`[${requestId}] → ${event.request.method} ${event.url.pathname}`);
	}

	try {
		// Check if database is available for non-static requests
		if (!event.url.pathname.startsWith('/_app') && 
		    !event.url.pathname.startsWith('/favicon') &&
		    !event.url.pathname.endsWith('.js') &&
		    !event.url.pathname.endsWith('.css') &&
		    !event.url.pathname.endsWith('.svg') &&
		    !event.url.pathname.endsWith('.png') &&
		    !event.url.pathname.endsWith('.ico')) {
			
			if (dbError && event.url.pathname !== '/health') {
				console.error(`[${requestId}] Database not available:`, dbError.message);
			}
		}

		const role = verifyRole(event.cookies.get('auth_role'));
		if (!role) event.cookies.delete('auth_role', { path: '/' });
		event.locals.role = role;

		const response = await resolve(event);
		
		// Log response
		if (process.env.NODE_ENV === 'production') {
			const duration = Date.now() - startTime;
			console.log(`[${requestId}] ← ${response.status} (${duration}ms)`);
		}

		return response;
	} catch (error) {
		const duration = Date.now() - startTime;
		console.error(`[${requestId}] ✖ ERROR after ${duration}ms:`, error);
		console.error(`[${requestId}] Stack:`, (error as Error).stack);
		throw error;
	}
};

// Global error handler for unhandled server errors
export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	// 404s are expected (missing routes, stale SW cache, etc.) — don't alarm-log them
	if (status === 404) {
		return { message, code: 'not-found' };
	}

	const errorId = crypto.randomUUID().slice(0, 8);

	console.error('═══════════════════════════════════════════════════');
	console.error(`❌ UNHANDLED SERVER ERROR [${errorId}]`);
	console.error('═══════════════════════════════════════════════════');
	console.error('Status:', status);
	console.error('Message:', message);
	console.error('Path:', event.url.pathname);
	console.error('Method:', event.request.method);
	console.error('Error:', error);
	if (error instanceof Error) {
		console.error('Stack:', error.stack);
	}
	console.error('═══════════════════════════════════════════════════');

	return {
		message: `An unexpected error occurred (${errorId})`,
		code: errorId
	};
};
