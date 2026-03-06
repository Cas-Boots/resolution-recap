import type { PageServerLoad } from './$types';
import { getActiveSeason, getSeasonStatsInRange, getActiveMetrics, getActivePeople, getGoalsForSeason, getMonthlyStats, getDailyStats, getStreaks, getDayOfWeekStats, getPersonalBests, getConsistencyScores, getCumulativeStats, getStreakWarnings, getSportTotals, getSportStatsByPerson, get2025SportingBaselines } from '$lib/server/db';

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
	const needsMonthlyStats = activeTab === 'overview' || activeTab === 'monthly' || activeTab === 'streaks';
	const needsDailyStats = activeTab === 'calendar';
	const needsStreaks = activeTab === 'streaks';
	const needsInsightData = activeTab === 'insights';
	const needsOverviewData = activeTab === 'overview' || activeTab === 'goals';
	const needsStreakWarnings = activeTab === 'overview' || activeTab === 'streaks';
	const needsGoals = activeTab === 'overview' || activeTab === 'goals';

	const stats = getSeasonStatsInRange(season.id, startDate, endDate);
	const goals = needsGoals ? getGoalsForSeason(season.id) : [];
	const monthlyStats = needsMonthlyStats ? getMonthlyStats(season.id) : [];
	const dailyStats = needsDailyStats ? getDailyStats(season.id) : [];
	
	// Get streaks for each metric
	const streaks: Record<number, ReturnType<typeof getStreaks>> = {};
	if (needsStreaks) {
		for (const metric of metrics) {
			streaks[metric.id] = getStreaks(season.id, metric.id);
		}
	}

	// New enhanced stats data
	const dayOfWeekStats = needsInsightData ? getDayOfWeekStats(season.id) : [];
	const personalBests = needsInsightData ? getPersonalBests(season.id) : {};
	const consistencyScores = needsInsightData ? getConsistencyScores(season.id) : [];
	const cumulativeStats = needsOverviewData ? getCumulativeStats(season.id) : [];
	const streakWarnings = needsStreakWarnings ? getStreakWarnings(season.id) : [];
	const sportTotals = needsOverviewData ? getSportTotals(season.id) : [];
	const sportStatsByPerson = needsOverviewData ? getSportStatsByPerson(season.id) : [];
	
	// Get 2025 baselines for projections - convert Map to object for serialization
	const baselines2025 = needsOverviewData ? Object.fromEntries(get2025SportingBaselines()) : {};

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
		sportTotals,
		sportStatsByPerson,
		baselines2025
	};
};
