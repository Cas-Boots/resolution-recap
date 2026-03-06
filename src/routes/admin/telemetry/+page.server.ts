import type { PageServerLoad } from './$types';
import { getRefreshTelemetryEvents, getRefreshTelemetrySummary } from '$lib/server/refreshTelemetry';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.role !== 'admin') {
		return { authorized: false };
	}

	const limit = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);

	return {
		authorized: true,
		summary: getRefreshTelemetrySummary(limit),
		events: getRefreshTelemetryEvents(limit)
	};
};
