import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BACKUP_TOKEN } from '$env/static/private';
import { importAllData, type ImportData } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, url, locals }) => {
	// Only allow access with admin role or backup token
	const token = url.searchParams.get('token');
	
	if (locals.role !== 'admin' && token !== BACKUP_TOKEN) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const data: ImportData = await request.json();
		
		// Validate the data structure
		if (!data || typeof data !== 'object') {
			return json({ error: 'Invalid data format' }, { status: 400 });
		}
		
		// Check if any importable data exists
		const hasData = data.seasons?.length || data.people?.length || data.metrics?.length || data.entries?.length;
		if (!hasData) {
			return json({ error: 'No data to import' }, { status: 400 });
		}
		
		// Get mode from query parameter (default: merge)
		const mode = url.searchParams.get('mode') === 'replace' ? 'replace' : 'merge';
		
		const result = importAllData(data, mode);
		
		if (result.success) {
			return json({
				success: true,
				message: `Import completed successfully (mode: ${mode})`,
				imported: result.imported,
				warnings: result.errors.length > 0 ? result.errors : undefined
			});
		} else {
			return json({
				success: false,
				error: 'Import failed',
				details: result.errors
			}, { status: 500 });
		}
	} catch (e) {
		return json({ error: 'Failed to parse import data', details: (e as Error).message }, { status: 400 });
	}
};
