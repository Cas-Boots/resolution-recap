import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const role = event.cookies.get('auth_role');
	
	// Set the role in locals for access in routes
	event.locals.role = role as 'tracker' | 'admin' | undefined;

	return resolve(event);
};
