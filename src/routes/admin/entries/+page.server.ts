import type { PageServerLoad } from './$types';
import { getActiveSeason, getEntriesForSeason, getAllPeople, getAllMetrics, getAllAuditLogs } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.role !== 'admin') {
		return { authorized: false };
	}

	const season = getActiveSeason();
	if (!season) {
		return { authorized: true, season: null, entries: [], deletedEntries: [], people: [], metrics: [], auditLogs: [] };
	}

	// Get all entries including deleted, but strip notes for admin view
	const allEntries = getEntriesForSeason(season.id, true).map(({ notes, ...rest }) => rest);
	const entries = allEntries.filter(e => !e.deleted_at);
	const deletedEntries = allEntries.filter(e => e.deleted_at);
	
	const people = getAllPeople();
	const metrics = getAllMetrics();
	const auditLogs = getAllAuditLogs(50);

	return {
		authorized: true,
		season,
		entries,
		deletedEntries,
		people,
		metrics,
		auditLogs
	};
};
