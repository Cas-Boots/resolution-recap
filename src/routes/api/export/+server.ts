import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exportAllData } from '$lib/server/db';
import { isAuthorizedBackup } from '$lib/server/backup-auth';

export const GET: RequestHandler = async ({ request, url, locals }) => {
	// Allow access with admin role or backup token
	if (locals.role !== 'admin' && !isAuthorizedBackup(url, request.headers.get('authorization'))) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const data = exportAllData();
	
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="resolution-recap-backup-${new Date().toISOString().split('T')[0]}.json"`
		}
	});
};
