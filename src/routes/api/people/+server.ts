import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as v from 'valibot';
import { getActivePeople, getAllPeople, createPerson, updatePerson } from '$lib/server/db';
import { checkAuth } from '$lib/server/handlers';
import { PersonCreateSchema, PersonUpdateSchema } from '$lib/server/schemas';

export const GET: RequestHandler = async ({ url, locals }) => {
	const deny = checkAuth(locals, 'tracker', 'admin');
	if (deny) return deny;

	const includeInactive = url.searchParams.get('all') === 'true';
	const people = includeInactive ? getAllPeople() : getActivePeople();
	return json(people);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const deny = checkAuth(locals, 'tracker');
	if (deny) return deny;

	const parsed = v.safeParse(PersonCreateSchema, await request.json());
	if (!parsed.success) return json({ error: 'Invalid input', issues: v.flatten(parsed.issues) }, { status: 400 });
	const { name, emoji } = parsed.output;

	const person = createPerson(name, emoji);
	return json(person, { status: 201 });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const deny = checkAuth(locals, 'tracker');
	if (deny) return deny;

	const parsed = v.safeParse(PersonUpdateSchema, await request.json());
	if (!parsed.success) return json({ error: 'Invalid input', issues: v.flatten(parsed.issues) }, { status: 400 });
	const { id, name, isActive, emoji } = parsed.output;

	updatePerson(id, name, isActive ?? true, emoji);
	return json({ success: true });
};
