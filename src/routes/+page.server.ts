import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getActiveSeason, getSeasonStatsFiltered, getActiveMetrics, getActivePeople } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';

type DashboardPeriod = 'today' | 'week' | 'month' | 'all';

function parsePeriod(value: string | null): DashboardPeriod {
	if (value === 'today' || value === 'week' || value === 'month' || value === 'all') {
		return value;
	}
	return 'all';
}

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

export const load: PageServerLoad = async ({ locals, depends, url }) => {
	depends('app:dashboard');

	const period = parsePeriod(url.searchParams.get('period'));

	console.log('📄 +page.server.ts load() called, role:', locals.role);
	
	requireRole(locals, 'tracker', 'admin');

	try {
		console.log('📄 Fetching active season...');
		const season = getActiveSeason();
		console.log('📄 Season result:', season);
		
		if (!season) {
			console.log('📄 No active season found, returning empty data');
			return {
				authorized: true,
				isAdmin: locals.role === 'admin',
				season: null,
				selectedPeriod: period,
				stats: [],
				metrics: [],
				people: [],
				recentEntries: [],
				sparklineData: [],
				todayEntries: [],
				weeklyComparison: [],
				streaks: [],
				goals: []
			};
		}

		if (!isValidSeason(season)) {
			console.error('❌ Invalid season data structure:', season);
			throw error(500, { message: 'Invalid season data from database' });
		}

		console.log('📄 Fetching dashboard data for season:', season.id);
		
		const stats = getSeasonStatsFiltered(season.id, period);
		console.log('📄 Stats fetched:', Array.isArray(stats) ? stats.length + ' items' : typeof stats);
		
		const metrics = getActiveMetrics();
		console.log('📄 Metrics fetched:', Array.isArray(metrics) ? metrics.length + ' items' : typeof metrics);
		
		const people = getActivePeople();
		console.log('📄 People fetched:', Array.isArray(people) ? people.length + ' items' : typeof people);

		// Validate all arrays
		const validations = [
			{ data: stats, name: 'stats' },
			{ data: metrics, name: 'metrics' },
			{ data: people, name: 'people' }
		];

		for (const { data, name } of validations) {
			if (!isValidArray(data, name)) {
				throw error(500, { message: `Invalid ${name} data from database` });
			}
		}

		console.log('📄 All data validated successfully, returning response');

		return {
			authorized: true,
			isAdmin: locals.role === 'admin',
			season,
			selectedPeriod: period,
			stats,
			metrics,
			people,
			recentEntries: [],
			sparklineData: [],
			todayEntries: [],
			weeklyComparison: [],
			streaks: [],
			goals: []
		};
	} catch (e) {
		console.error('❌ Error loading dashboard data:', e);
		console.error('Stack:', e instanceof Error ? e.stack : 'No stack');
		throw error(500, {
			message: 'Failed to load dashboard data'
		});
	}
};
