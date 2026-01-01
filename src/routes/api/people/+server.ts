import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActivePeople, getAllPeople, createPerson, updatePerson } from '$lib/server/db';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (locals.role !== 'tracker' && locals.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const includeInactive = url.searchParams.get('all') === 'true';
	const people = includeInactive ? getAllPeople() : getActivePeople();
	return json(people);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (locals.role !== 'tracker') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { name, emoji } = await request.json();
	const person = createPerson(name, emoji);
	return json(person, { status: 201 });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (locals.role !== 'tracker') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id, name, isActive, emoji } = await request.json();
	updatePerson(id, name, isActive, emoji);
	return json({ success: true });
};
