import type { PageServerLoad } from './$types';
import { getAllPeople, getAllMetrics, getActiveSeason, getGoalsForSeason, getCountriesVisitedForSeason } from '$lib/server/db';
import { getSortedCountries } from '$lib/countries';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.role !== 'tracker') {
		return { authorized: false };
	}

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
