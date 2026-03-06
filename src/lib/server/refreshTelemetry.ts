export type RefreshTelemetryEvent = {
	source: string;
	durationMs: number;
	success: boolean;
	period: 'today' | 'week' | 'month' | 'all';
	online: boolean;
	pendingOfflineCount: number;
	role: 'tracker' | 'admin';
	client: string;
	timestamp: string;
};

const MAX_EVENTS = 300;
const events: RefreshTelemetryEvent[] = [];

export function addRefreshTelemetryEvent(event: RefreshTelemetryEvent): void {
	events.unshift(event);
	if (events.length > MAX_EVENTS) {
		events.length = MAX_EVENTS;
	}
}

export function getRefreshTelemetryEvents(limit = 100): RefreshTelemetryEvent[] {
	const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(300, Math.floor(limit))) : 100;
	return events.slice(0, safeLimit);
}

export function getRefreshTelemetrySummary(sampleSize = 100): {
	totalEvents: number;
	sampledEvents: number;
	successRate: number;
	averageDurationMs: number;
	bySource: Record<string, { count: number; avgDurationMs: number }>;
} {
	const sample = getRefreshTelemetryEvents(sampleSize);
	const successful = sample.filter((event) => event.success).length;
	const successRate = sample.length > 0 ? Math.round((successful / sample.length) * 100) : 0;
	const averageDurationMs = sample.length > 0
		? Math.round(sample.reduce((sum, event) => sum + event.durationMs, 0) / sample.length)
		: 0;

	const bySourceMap = new Map<string, { count: number; totalDurationMs: number }>();
	for (const event of sample) {
		const existing = bySourceMap.get(event.source);
		if (existing) {
			existing.count += 1;
			existing.totalDurationMs += event.durationMs;
		} else {
			bySourceMap.set(event.source, { count: 1, totalDurationMs: event.durationMs });
		}
	}

	const bySource: Record<string, { count: number; avgDurationMs: number }> = {};
	for (const [source, value] of bySourceMap.entries()) {
		bySource[source] = {
			count: value.count,
			avgDurationMs: Math.round(value.totalDurationMs / value.count)
		};
	}

	return {
		totalEvents: events.length,
		sampledEvents: sample.length,
		successRate,
		averageDurationMs,
		bySource
	};
}
