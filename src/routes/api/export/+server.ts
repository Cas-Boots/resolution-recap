import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BACKUP_TOKEN } from '$env/static/private';
import { exportAllData } from '$lib/server/db';

export const GET: RequestHandler = async ({ url, locals }) => {
	// Allow access with admin role or backup token
	const token = url.searchParams.get('token');
	
	if (locals.role !== 'admin' && token !== BACKUP_TOKEN) {
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
