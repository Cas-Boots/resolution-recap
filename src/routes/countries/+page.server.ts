import type { PageServerLoad } from './$types';
import { getActiveSeason, getActivePeople, getCountriesVisitedForSeason, getCountriesStats } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.role !== 'tracker') {
		return { authorized: false };
	}

	const season = getActiveSeason();
	if (!season) {
		return { authorized: true, season: null, people: [], countriesVisited: [], countriesStats: [] };
	}

	const people = getActivePeople();
	const countriesVisited = getCountriesVisitedForSeason(season.id);
	const countriesStats = getCountriesStats(season.id);

	return {
		authorized: true,
		season,
		people,
		countriesVisited,
		countriesStats
	};
};
