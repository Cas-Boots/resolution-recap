import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGoalsForSeason, getGoal, setGoal, deleteGoal, getActiveSeason } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
	if (locals.role !== 'tracker') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const season = getActiveSeason();
	if (!season) {
		return json({ error: 'No active season' }, { status: 400 });
	}

	const goals = getGoalsForSeason(season.id);
	return json(goals);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (locals.role !== 'tracker') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const season = getActiveSeason();
	if (!season) {
		return json({ error: 'No active season' }, { status: 400 });
	}

	const { personId, metricId, target } = await request.json();
	
	if (!personId || !metricId || target === undefined) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	const goal = setGoal(season.id, personId, metricId, target);
	return json(goal, { status: 201 });
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
	const metricId = parseInt(url.searchParams.get('metricId') || '0');
	
	if (!personId || !metricId) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	deleteGoal(season.id, personId, metricId);
	return json({ success: true });
};
