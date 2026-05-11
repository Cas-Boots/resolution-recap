import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as v from 'valibot';
import { getActiveMetrics, getAllMetrics, createMetric, updateMetric } from '$lib/server/db';
import { checkAuth } from '$lib/server/handlers';
import { MetricCreateSchema, MetricUpdateSchema } from '$lib/server/schemas';

export const GET: RequestHandler = async ({ url, locals }) => {
	const deny = checkAuth(locals, 'tracker', 'admin');
	if (deny) return deny;

	const includeInactive = url.searchParams.get('all') === 'true';
	const metrics = includeInactive ? getAllMetrics() : getActiveMetrics();
	return json(metrics);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const deny = checkAuth(locals, 'tracker');
	if (deny) return deny;

	const parsed = v.safeParse(MetricCreateSchema, await request.json());
	if (!parsed.success) return json({ error: 'Invalid input', issues: v.flatten(parsed.issues) }, { status: 400 });
	const { name, emoji, name_nl } = parsed.output;

	const metric = createMetric(name, emoji, name_nl);
	return json(metric, { status: 201 });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const deny = checkAuth(locals, 'tracker');
	if (deny) return deny;

	const parsed = v.safeParse(MetricUpdateSchema, await request.json());
	if (!parsed.success) return json({ error: 'Invalid input', issues: v.flatten(parsed.issues) }, { status: 400 });
	const { id, name, isActive, emoji, name_nl } = parsed.output;

	updateMetric(id, name, isActive ?? true, emoji, name_nl);
	return json({ success: true });
};
