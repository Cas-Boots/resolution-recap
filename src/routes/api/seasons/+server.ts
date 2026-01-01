import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllSeasons, getActiveSeason, setActiveSeason, createSeason } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
	if (locals.role !== 'tracker' && locals.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const seasons = getAllSeasons();
	const activeSeason = getActiveSeason();
	return json({ seasons, activeSeason });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (locals.role !== 'admin') {
		return json({ error: 'Unauthorized - Admin only' }, { status: 401 });
	}

	const { year, name } = await request.json();
	const season = createSeason(year, name);
	return json(season, { status: 201 });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (locals.role !== 'admin') {
		return json({ error: 'Unauthorized - Admin only' }, { status: 401 });
	}

	const { id } = await request.json();
	setActiveSeason(id);
	return json({ success: true });
};
