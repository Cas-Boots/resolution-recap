import type { PageServerLoad } from './$types';
import { getActiveSeason, getActivePeople, getActiveMetrics } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'tracker');

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
