import type { PageServerLoad } from './$types';
import { getActiveSeason, getSeasonStats, getActiveMetrics, getActivePeople, getRecentEntries, getDailyCountsForSparkline, getTodayEntries, getWeeklyComparison, getStreaksSimple, getGoalsWithProgress } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.role !== 'tracker') {
		return { authorized: false };
	}

	const season = getActiveSeason();
	if (!season) {
		return { authorized: true, season: null, stats: [], metrics: [], people: [], recentEntries: [], sparklineData: [], todayEntries: [], weeklyComparison: [], streaks: [], goals: [] };
	}

	const stats = getSeasonStats(season.id);
	const metrics = getActiveMetrics();
	const people = getActivePeople();
	const recentEntries = getRecentEntries(season.id, 10);
	const sparklineData = getDailyCountsForSparkline(season.id, 7);
	const todayEntries = getTodayEntries(season.id);
	const weeklyComparison = getWeeklyComparison(season.id);
	const streaks = getStreaksSimple(season.id);
	const goals = getGoalsWithProgress(season.id);

	return {
		authorized: true,
		season,
		stats,
		metrics,
		people,
		recentEntries,
		sparklineData,
		todayEntries,
		weeklyComparison,
		streaks,
		goals
	};
};
