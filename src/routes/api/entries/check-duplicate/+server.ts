import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkDuplicateEntry, getActiveSeason } from '$lib/server/db';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (locals.role !== 'tracker' && locals.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const personId = url.searchParams.get('personId');
	const metricId = url.searchParams.get('metricId');
	const entryDate = url.searchParams.get('entryDate');

	if (!personId || !metricId || !entryDate) {
		return json({ error: 'Missing required parameters' }, { status: 400 });
	}

	const season = getActiveSeason();
	if (!season) {
		return json({ error: 'No active season' }, { status: 400 });
	}

	const existing = checkDuplicateEntry(
		season.id,
		parseInt(personId),
		parseInt(metricId),
		entryDate
	);

	return json({ 
		isDuplicate: !!existing,
		existing: existing ? {
			id: existing.id,
			personName: existing.person_name,
			metricName: existing.metric_name,
			entryDate: existing.entry_date,
			tags: existing.tags
		} : null
	});
};
