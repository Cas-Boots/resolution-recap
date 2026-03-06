import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getActiveSeason,
	getDailyStats,
	getDayOfWeekStats,
	getConsistencyScores,
	getPersonalBests
} from '$lib/server/db';

type LazyStatsTab = 'calendar' | 'insights';

function isLazyStatsTab(value: string | null): value is LazyStatsTab {
	return value === 'calendar' || value === 'insights';
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (locals.role !== 'tracker') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const tabParam = url.searchParams.get('tab');
	if (!isLazyStatsTab(tabParam)) {
		return json({ error: 'Invalid tab' }, { status: 400 });
	}

	const season = getActiveSeason();
	if (!season) {
		return json({ tab: tabParam, payload: {} });
	}

	if (tabParam === 'calendar') {
		return json({
			tab: tabParam,
			payload: {
				dailyStats: getDailyStats(season.id)
			}
		});
	}

	return json({
		tab: tabParam,
		payload: {
			dayOfWeekStats: getDayOfWeekStats(season.id),
			consistencyScores: getConsistencyScores(season.id),
			personalBests: getPersonalBests(season.id)
		}
	});
};
