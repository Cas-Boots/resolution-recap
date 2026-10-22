import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validatePin } from '$lib/server/db';
import {
	signRole,
	checkAuthRateLimit,
	resetAuthRateLimit,
	AUTH_COOKIE,
	authCookieOptions
} from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const ip = getClientAddress();

	if (!checkAuthRateLimit(ip)) {
		return json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
	}

	const { pin } = await request.json();
	const role = validatePin(pin);

	if (role) {
		resetAuthRateLimit(ip);
		cookies.set(AUTH_COOKIE, signRole(role), authCookieOptions());
		return json({ role });
	}

	return json({ error: 'Invalid PIN' }, { status: 401 });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	const { maxAge: _maxAge, ...options } = authCookieOptions();
	cookies.delete(AUTH_COOKIE, options);
	return json({ success: true });
};
