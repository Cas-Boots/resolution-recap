import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { exportAllData } from '$lib/server/db';

function getBackupToken(url: URL, authHeader: string | null): string {
	const queryToken = url.searchParams.get('token');
	if (queryToken) return queryToken;

	if (authHeader?.startsWith('Bearer ')) {
		return authHeader.slice(7).trim();
	}

	return '';
}

export const GET: RequestHandler = async ({ request, url, locals }) => {
	// Allow access with admin role or backup token
	const token = getBackupToken(url, request.headers.get('authorization'));
	
	if (locals.role !== 'admin' && token !== env.BACKUP_TOKEN) {
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
