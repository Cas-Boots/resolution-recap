import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getActiveSeason, getSeasonStats, getActiveMetrics, getActivePeople, getRecentEntries, getDailyCountsForSparkline, getTodayEntries, getWeeklyComparison, getStreaksSimple, getGoalsWithProgress } from '$lib/server/db';

// Type guards for data validation
function isValidSeason(data: unknown): data is { id: number; year: number; name: string } {
	return data !== null && 
		typeof data === 'object' && 
		'id' in data && typeof (data as any).id === 'number' &&
		'year' in data && typeof (data as any).year === 'number' &&
		'name' in data && typeof (data as any).name === 'string';
}

function isValidArray(data: unknown, name: string): data is unknown[] {
	if (!Array.isArray(data)) {
		console.error(`❌ ${name} is not an array:`, typeof data, data);
		return false;
	}
	return true;
}

export const load: PageServerLoad = async ({ locals }) => {
	console.log('📄 +page.server.ts load() called, role:', locals.role);
	
	// Allow both tracker and admin roles to view the dashboard
	if (locals.role !== 'tracker' && locals.role !== 'admin') {
		console.log('📄 Not authorized, returning unauthorized response');
		return { authorized: false };
	}

	try {
		console.log('📄 Fetching active season...');
		const season = getActiveSeason();
		console.log('📄 Season result:', season);
		
		if (!season) {
			console.log('📄 No active season found, returning empty data');
			return { authorized: true, season: null, stats: [], metrics: [], people: [], recentEntries: [], sparklineData: [], todayEntries: [], weeklyComparison: [], streaks: [], goals: [] };
		}

		if (!isValidSeason(season)) {
			console.error('❌ Invalid season data structure:', season);
			throw error(500, { message: 'Invalid season data from database' });
		}

		console.log('📄 Fetching dashboard data for season:', season.id);
		
		const stats = getSeasonStats(season.id);
		console.log('📄 Stats fetched:', Array.isArray(stats) ? stats.length + ' items' : typeof stats);
		
		const metrics = getActiveMetrics();
		console.log('📄 Metrics fetched:', Array.isArray(metrics) ? metrics.length + ' items' : typeof metrics);
		
		const people = getActivePeople();
		console.log('📄 People fetched:', Array.isArray(people) ? people.length + ' items' : typeof people);
		
		const recentEntries = getRecentEntries(season.id, 10);
		console.log('📄 Recent entries fetched:', Array.isArray(recentEntries) ? recentEntries.length + ' items' : typeof recentEntries);
		
		const sparklineData = getDailyCountsForSparkline(season.id, 7);
		console.log('📄 Sparkline data fetched:', Array.isArray(sparklineData) ? sparklineData.length + ' items' : typeof sparklineData);
		
		const todayEntries = getTodayEntries(season.id);
		console.log('📄 Today entries fetched:', Array.isArray(todayEntries) ? todayEntries.length + ' items' : typeof todayEntries);
		
		const weeklyComparison = getWeeklyComparison(season.id);
		console.log('📄 Weekly comparison fetched:', Array.isArray(weeklyComparison) ? weeklyComparison.length + ' items' : typeof weeklyComparison);
		
		const streaks = getStreaksSimple(season.id);
		console.log('📄 Streaks fetched:', Array.isArray(streaks) ? streaks.length + ' items' : typeof streaks);
		
		const goals = getGoalsWithProgress(season.id);
		console.log('📄 Goals fetched:', Array.isArray(goals) ? goals.length + ' items' : typeof goals);

		// Validate all arrays
		const validations = [
			{ data: stats, name: 'stats' },
			{ data: metrics, name: 'metrics' },
			{ data: people, name: 'people' },
			{ data: recentEntries, name: 'recentEntries' },
			{ data: sparklineData, name: 'sparklineData' },
			{ data: todayEntries, name: 'todayEntries' },
			{ data: weeklyComparison, name: 'weeklyComparison' },
			{ data: streaks, name: 'streaks' },
			{ data: goals, name: 'goals' }
		];

		for (const { data, name } of validations) {
			if (!isValidArray(data, name)) {
				throw error(500, { message: `Invalid ${name} data from database` });
			}
		}

		console.log('📄 All data validated successfully, returning response');

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
	} catch (e) {
		console.error('❌ Error loading dashboard data:', e);
		console.error('Stack:', e instanceof Error ? e.stack : 'No stack');
		throw error(500, {
			message: 'Failed to load dashboard data'
		});
	}
};
