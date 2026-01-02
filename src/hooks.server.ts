import type { Handle, HandleServerError } from '@sveltejs/kit';

// Startup logging
console.log('🚀 Starting Resolution Recap server...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('📍 DB_PATH:', process.env.DB_PATH || './data/resolution-recap.db');
console.log('📍 HOST:', process.env.HOST || 'localhost');
console.log('📍 PORT:', process.env.PORT || '5173');

// Test database connection on startup
import { db } from '$lib/server/db';
try {
	// This will trigger lazy initialization
	const test = db.prepare('SELECT 1').get();
	console.log('✅ Database connection verified');
} catch (error) {
	console.error('❌ Database connection failed:', error);
}

export const handle: Handle = async ({ event, resolve }) => {
	const startTime = Date.now();
	const role = event.cookies.get('auth_role');
	
	// Set the role in locals for access in routes
	event.locals.role = role as 'tracker' | 'admin' | undefined;

	const response = await resolve(event);
	
	// Log requests in production for debugging
	if (process.env.NODE_ENV === 'production') {
		const duration = Date.now() - startTime;
		console.log(`${event.request.method} ${event.url.pathname} - ${response.status} (${duration}ms)`);
	}

	return response;
};

// Global error handler for unhandled server errors
export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	console.error('❌ Server error:', {
		status,
		message,
		path: event.url.pathname,
		error: error instanceof Error ? error.stack : error
	});

	return {
		message: 'An unexpected error occurred',
		code: status.toString()
	};
};
