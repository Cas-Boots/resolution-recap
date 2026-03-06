import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validatePin } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { pin } = await request.json();

	const role = validatePin(pin);
	
	if (role) {
		const isProduction = process.env.NODE_ENV === 'production';
		cookies.set('auth_role', role, {
			path: '/',
			httpOnly: true,
			secure: isProduction,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 * 365 // 1 year
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
