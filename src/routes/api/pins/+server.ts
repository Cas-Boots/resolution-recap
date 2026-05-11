import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as v from 'valibot';
import { changeTrackerPin, changeAdminPin } from '$lib/server/db';
import { checkAuth } from '$lib/server/handlers';
import { PinChangeSchema } from '$lib/server/schemas';

export const PUT: RequestHandler = async ({ request, locals, cookies }) => {
	if (locals.role !== 'admin') {
		return json({ error: 'Unauthorized - Admin only' }, { status: 403 });
	}

	const parsed = v.safeParse(PinChangeSchema, await request.json());
	if (!parsed.success) return json({ error: 'Invalid input', issues: v.flatten(parsed.issues) }, { status: 400 });
	const { type, newPin } = parsed.output;

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
