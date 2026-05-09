import type { PageServerLoad } from './$types';
import { getAllPeople, getAllMetrics, getActiveSeason, getGoalsForSeason, getCountriesVisitedForSeason } from '$lib/server/db';
import { getSortedCountries } from '$lib/countries';
import { requireRole } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'tracker');

	const people = getAllPeople();
	const metrics = getAllMetrics();
	const season = getActiveSeason();
	const goals = season ? getGoalsForSeason(season.id) : [];
	const countriesVisited = season ? getCountriesVisitedForSeason(season.id) : [];
	const availableCountries = getSortedCountries();

	return {
		authorized: true,
		people,
		metrics,
		season,
		goals,
		countriesVisited,
		availableCountries
	};
};
