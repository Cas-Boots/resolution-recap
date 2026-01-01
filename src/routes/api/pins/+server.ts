import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { changeTrackerPin, changeAdminPin } from '$lib/server/db';

export const PUT: RequestHandler = async ({ request, cookies }) => {
	// Only admin can change PINs
	const role = cookies.get('auth_role');
	if (role !== 'admin') {
		return json({ error: 'Unauthorized - Admin only' }, { status: 403 });
	}

	const { type, newPin } = await request.json();

	if (type === 'tracker') {
		const result = changeTrackerPin(newPin);
		if (!result.success) {
			return json({ error: result.error }, { status: 400 });
		}
		return json({ success: true, message: 'Tracker PIN updated successfully' });
	}

	if (type === 'admin') {
		const result = changeAdminPin(newPin);
		if (!result.success) {
			return json({ error: result.error }, { status: 400 });
		}
		// After changing admin PIN, log them out so they need to re-auth with new PIN
		cookies.delete('auth_role', { path: '/' });
		return json({ success: true, message: 'Admin PIN updated. Please log in again with the new PIN.', logout: true });
	}

	return json({ error: 'Invalid PIN type' }, { status: 400 });
};
