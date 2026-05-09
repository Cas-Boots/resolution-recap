import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validatePin } from '$lib/server/db';
import { signRole, checkAuthRateLimit, resetAuthRateLimit } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const ip = getClientAddress();

	if (!checkAuthRateLimit(ip)) {
		return json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
	}

	const { pin } = await request.json();
	const role = validatePin(pin);

	if (role) {
		resetAuthRateLimit(ip);
		const isProduction = process.env.NODE_ENV === 'production';
		cookies.set('auth_role', signRole(role), {
			path: '/',
			httpOnly: true,
			secure: isProduction,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});
		return json({ role });
	}

	return json({ error: 'Invalid PIN' }, { status: 401 });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	const isProduction = process.env.NODE_ENV === 'production';
	cookies.delete('auth_role', {
		path: '/',
		httpOnly: true,
		secure: isProduction,
		sameSite: 'strict'
	});
	return json({ success: true });
};
