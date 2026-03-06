import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getActiveSeason,
	getRecentEntries,
	getDailyCountsForSparkline,
	getTodayEntries,
	getWeeklyComparison,
	getStreaksSimple,
	getGoalsWithProgress
} from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
	if (locals.role !== 'tracker' && locals.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const season = getActiveSeason();
	if (!season) {
		return json({
			recentEntries: [],
			sparklineData: [],
			todayEntries: [],
			weeklyComparison: [],
			streaks: [],
			goals: []
		});
	}

	return json({
		recentEntries: getRecentEntries(season.id, 10),
		sparklineData: getDailyCountsForSparkline(season.id, 7),
		todayEntries: getTodayEntries(season.id),
		weeklyComparison: getWeeklyComparison(season.id),
		streaks: getStreaksSimple(season.id),
		goals: getGoalsWithProgress(season.id)
	});
};
