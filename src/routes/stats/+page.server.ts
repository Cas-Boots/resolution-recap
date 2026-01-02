import type { PageServerLoad } from './$types';
import { getActiveSeason, getSeasonStatsInRange, getActiveMetrics, getActivePeople, getGoalsForSeason, getMonthlyStats, getDailyStats, getStreaks, getDayOfWeekStats, getPersonalBests, getConsistencyScores, getCumulativeStats, getStreakWarnings, getSportProgression, getSportTotals, getSportProgressionByPerson, getSportStatsByPerson, get2025SportingBaselines } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.role !== 'tracker') {
		return { authorized: false };
	}

	const season = getActiveSeason();
	if (!season) {
		return { authorized: true, season: null, stats: [], metrics: [], people: [], goals: [], monthlyStats: [], dailyStats: [], streaks: {}, dayOfWeekStats: [], personalBests: {}, consistencyScores: [], cumulativeStats: [], streakWarnings: [], sportProgression: [], sportTotals: [], sportProgressionByPerson: [], sportStatsByPerson: [] };
	}

	const metrics = getActiveMetrics();
	const people = getActivePeople();

	// Get date range from query params, default to full year
	const startDate = url.searchParams.get('startDate') || `${season.year}-01-01`;
	const endDate = url.searchParams.get('endDate') || `${season.year}-12-31`;
	const activeTab = url.searchParams.get('tab') || 'overview';

	const stats = getSeasonStatsInRange(season.id, startDate, endDate);
	const goals = getGoalsForSeason(season.id);
	const monthlyStats = getMonthlyStats(season.id);
	const dailyStats = getDailyStats(season.id);
	
	// Get streaks for each metric
	const streaks: Record<number, ReturnType<typeof getStreaks>> = {};
	for (const metric of metrics) {
		streaks[metric.id] = getStreaks(season.id, metric.id);
	}

	// New enhanced stats data
	const dayOfWeekStats = getDayOfWeekStats(season.id);
	const personalBests = getPersonalBests(season.id);
	const consistencyScores = getConsistencyScores(season.id);
	const cumulativeStats = getCumulativeStats(season.id);
	const streakWarnings = getStreakWarnings(season.id);
	const sportProgression = getSportProgression(season.id);
	const sportTotals = getSportTotals(season.id);
	const sportProgressionByPerson = getSportProgressionByPerson(season.id);
	const sportStatsByPerson = getSportStatsByPerson(season.id);
	
	// Get 2025 baselines for projections - convert Map to object for serialization
	const baselines2025 = Object.fromEntries(get2025SportingBaselines());

	return {
		authorized: true,
		season,
		stats,
		metrics,
		people,
		goals,
		monthlyStats,
		dailyStats,
		streaks,
		startDate,
		endDate,
		activeTab,
		dayOfWeekStats,
		personalBests,
		consistencyScores,
		cumulativeStats,
		streakWarnings,
		sportProgression,
		sportTotals,
		sportProgressionByPerson,
		sportStatsByPerson,
		baselines2025
	};
};
