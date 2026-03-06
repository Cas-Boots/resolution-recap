import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addRefreshTelemetryEvent, getRefreshTelemetryEvents, getRefreshTelemetrySummary } from '$lib/server/refreshTelemetry';

type RefreshTelemetryPayload = {
	source?: string;
	durationMs?: number;
	success?: boolean;
	period?: 'today' | 'week' | 'month' | 'all';
	online?: boolean;
	pendingOfflineCount?: number;
	timestamp?: string;
};

function isAllowedSource(value: string): boolean {
	return [
		'manual-refresh',
		'keyboard-refresh',
		'pull-to-refresh',
		'post-entry',
		'undo-entry',
		'manual-sync',
		'reconnect-auto',
		'server-recovered',
		'period-change',
		'secondary-hydration',
		'post-refresh-secondary'
	].includes(value);
}

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	if (locals.role !== 'tracker' && locals.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let payload: RefreshTelemetryPayload;
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const source = typeof payload.source === 'string' && isAllowedSource(payload.source)
		? payload.source
		: 'unknown';
	const durationMs = typeof payload.durationMs === 'number' && Number.isFinite(payload.durationMs)
		? Math.max(0, Math.round(payload.durationMs))
		: -1;
	const success = Boolean(payload.success);
	const period = payload.period ?? 'all';
	const online = payload.online ?? true;
	const pendingOfflineCount = typeof payload.pendingOfflineCount === 'number'
		? Math.max(0, Math.round(payload.pendingOfflineCount))
		: 0;
	const timestamp = payload.timestamp ?? new Date().toISOString();

	addRefreshTelemetryEvent({
		source,
		durationMs,
		success,
		period,
		online,
		pendingOfflineCount,
		role: locals.role,
		client: getClientAddress(),
		timestamp
	});

	console.info('📈 refresh-telemetry', {
		source,
		durationMs,
		success,
		period,
		online,
		pendingOfflineCount,
		role: locals.role,
		client: getClientAddress(),
		timestamp
	});

	return json({ ok: true });
};

export const GET: RequestHandler = async ({ locals, url }) => {
	if (locals.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const limit = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);

	return json({
		summary: getRefreshTelemetrySummary(limit),
		events: getRefreshTelemetryEvents(limit)
	});
};
