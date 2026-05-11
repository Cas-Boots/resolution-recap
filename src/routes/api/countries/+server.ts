import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as v from 'valibot';
import { getCountriesVisitedForSeason, getCountriesStats, addCountryVisit, removeCountryVisit } from '$lib/server/db';
import { checkAuth, getSeasonOrError } from '$lib/server/handlers';
import { CountryCreateSchema } from '$lib/server/schemas';

export const GET: RequestHandler = async ({ url, locals }) => {
	const deny = checkAuth(locals, 'tracker', 'admin');
	if (deny) return deny;

	const { season, error } = getSeasonOrError();
	if (error) return error;

	const stats = url.searchParams.get('stats') === 'true';

	if (stats) {
		const countriesStats = getCountriesStats(season.id);
		return json(countriesStats);
	}

	const countries = getCountriesVisitedForSeason(season.id);
	return json(countries);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const deny = checkAuth(locals, 'tracker');
	if (deny) return deny;

	const { season, error } = getSeasonOrError();
	if (error) return error;

	const parsed = v.safeParse(CountryCreateSchema, await request.json());
	if (!parsed.success) return json({ error: 'Invalid input', issues: v.flatten(parsed.issues) }, { status: 400 });
	const { personId, countryCode, countryName } = parsed.output;

	const visit = addCountryVisit(season.id, personId, countryCode, countryName);
	return json(visit, { status: 201 });
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	const deny = checkAuth(locals, 'tracker');
	if (deny) return deny;

	const { season, error } = getSeasonOrError();
	if (error) return error;

	const personId = parseInt(url.searchParams.get('personId') || '0');
	const countryCode = url.searchParams.get('countryCode') || '';

	if (!personId || !countryCode) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	removeCountryVisit(season.id, personId, countryCode);
	return json({ success: true });
};
