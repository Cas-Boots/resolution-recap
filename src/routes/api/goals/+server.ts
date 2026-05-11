import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as v from 'valibot';
import { getGoalsForSeason, getGoal, setGoal, deleteGoal } from '$lib/server/db';
import { checkAuth, getSeasonOrError } from '$lib/server/handlers';
import { GoalCreateSchema } from '$lib/server/schemas';

export const GET: RequestHandler = async ({ locals }) => {
	const deny = checkAuth(locals, 'tracker');
	if (deny) return deny;

	const { season, error } = getSeasonOrError();
	if (error) return error;

	const goals = getGoalsForSeason(season.id);
	return json(goals);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const deny = checkAuth(locals, 'tracker');
	if (deny) return deny;

	const { season, error } = getSeasonOrError();
	if (error) return error;

	const parsed = v.safeParse(GoalCreateSchema, await request.json());
	if (!parsed.success) return json({ error: 'Invalid input', issues: v.flatten(parsed.issues) }, { status: 400 });
	const { personId, metricId, target } = parsed.output;

	const goal = setGoal(season.id, personId, metricId, target);
	return json(goal, { status: 201 });
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	const deny = checkAuth(locals, 'tracker');
	if (deny) return deny;

	const { season, error } = getSeasonOrError();
	if (error) return error;

	const personId = parseInt(url.searchParams.get('personId') || '0');
	const metricId = parseInt(url.searchParams.get('metricId') || '0');

	if (!personId || !metricId) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	deleteGoal(season.id, personId, metricId);
	return json({ success: true });
};
