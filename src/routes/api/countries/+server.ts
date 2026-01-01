import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveSeason, getCountriesVisitedForSeason, getCountriesStats, addCountryVisit, removeCountryVisit } from '$lib/server/db';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (locals.role !== 'tracker' && locals.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const season = getActiveSeason();
	if (!season) {
		return json({ error: 'No active season' }, { status: 400 });
	}

	const stats = url.searchParams.get('stats') === 'true';
	
	if (stats) {
		const countriesStats = getCountriesStats(season.id);
		return json(countriesStats);
	}

	const countries = getCountriesVisitedForSeason(season.id);
	return json(countries);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (locals.role !== 'tracker') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const season = getActiveSeason();
	if (!season) {
		return json({ error: 'No active season' }, { status: 400 });
	}

	const { personId, countryCode, countryName } = await request.json();
	
	if (!personId || !countryCode || !countryName) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	const visit = addCountryVisit(season.id, personId, countryCode, countryName);
	return json(visit, { status: 201 });
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	if (locals.role !== 'tracker') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const season = getActiveSeason();
	if (!season) {
		return json({ error: 'No active season' }, { status: 400 });
	}

	const personId = parseInt(url.searchParams.get('personId') || '0');
	const countryCode = url.searchParams.get('countryCode') || '';
	
	if (!personId || !countryCode) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	removeCountryVisit(season.id, personId, countryCode);
	return json({ success: true });
};
