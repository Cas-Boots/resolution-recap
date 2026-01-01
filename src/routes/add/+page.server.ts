import type { PageServerLoad } from './$types';
import { getActiveSeason, getActivePeople, getActiveMetrics } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.role !== 'tracker') {
		return { authorized: false };
	}

	const season = getActiveSeason();
	const people = getActivePeople();
	const metrics = getActiveMetrics();

	// Default to today's date
	const today = new Date().toISOString().split('T')[0];

	return {
		authorized: true,
		season,
		people,
		metrics,
		today
	};
};
