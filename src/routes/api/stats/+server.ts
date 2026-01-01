import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSeasonStats, getSeasonStatsInRange, getActiveSeason } from '$lib/server/db';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (locals.role !== 'tracker') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const season = getActiveSeason();
	if (!season) {
		return json({ error: 'No active season' }, { status: 400 });
	}

	const startDate = url.searchParams.get('startDate');
	const endDate = url.searchParams.get('endDate');

	let stats;
	if (startDate && endDate) {
		stats = getSeasonStatsInRange(season.id, startDate, endDate);
	} else {
		stats = getSeasonStats(season.id);
	}

	return json(stats);
};
