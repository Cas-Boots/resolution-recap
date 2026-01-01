import type { PageServerLoad } from './$types';
import { getActiveSeason, getSeasonStatsInRange, getActiveMetrics, getActivePeople, getGoalsForSeason, getMonthlyStats, getStreaks, getEntriesForSeason } from '$lib/server/db';
import type { StreakData } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.role !== 'tracker') {
		return { authorized: false };
	}

	const season = getActiveSeason();
	if (!season) {
		return { authorized: true, season: null };
	}

	const metrics = getActiveMetrics();
	const people = getActivePeople();
	const stats = getSeasonStatsInRange(season.id, `${season.year}-01-01`, `${season.year}-12-31`);
	const goals = getGoalsForSeason(season.id);
	const monthlyStats = getMonthlyStats(season.id);
	const entries = getEntriesForSeason(season.id);
	
	// Get streaks for each metric
	const streaks: Record<number, StreakData[]> = {};
	for (const metric of metrics) {
		streaks[metric.id] = getStreaks(season.id, metric.id);
	}
	
	// Get selected person from query param
	const selectedPersonId = url.searchParams.get('person');

	return {
		authorized: true,
		season,
		stats,
		metrics,
		people,
		goals,
		monthlyStats,
		streaks,
		entries,
		selectedPersonId: selectedPersonId ? parseInt(selectedPersonId) : null
	};
};
