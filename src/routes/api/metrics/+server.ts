import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveMetrics, getAllMetrics, createMetric, updateMetric } from '$lib/server/db';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (locals.role !== 'tracker' && locals.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const includeInactive = url.searchParams.get('all') === 'true';
	const metrics = includeInactive ? getAllMetrics() : getActiveMetrics();
	return json(metrics);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (locals.role !== 'tracker') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { name, emoji } = await request.json();
	const metric = createMetric(name, emoji);
	return json(metric, { status: 201 });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (locals.role !== 'tracker') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id, name, isActive, emoji } = await request.json();
	updateMetric(id, name, isActive, emoji);
	return json({ success: true });
};
