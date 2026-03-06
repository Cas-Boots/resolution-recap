<script lang="ts">
	import type { PageData } from './$types';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	interface Props {
		data: PageData;
	}

	type TelemetrySummary = {
		totalEvents: number;
		sampledEvents: number;
		successRate: number;
		averageDurationMs: number;
		bySource: Record<string, { count: number; avgDurationMs: number }>;
	};

	type TelemetryEvent = {
		source: string;
		durationMs: number;
		success: boolean;
		period: 'today' | 'week' | 'month' | 'all';
		online: boolean;
		pendingOfflineCount: number;
		role?: 'tracker' | 'admin';
		client?: string;
		timestamp: string;
	};

	let { data }: Props = $props();
	let summaryState = $state<TelemetrySummary>(
		data.summary ?? {
			totalEvents: 0,
			sampledEvents: 0,
			successRate: 0,
			averageDurationMs: 0,
			bySource: {}
		}
	);
	let eventsState = $state<TelemetryEvent[]>((data.events as TelemetryEvent[]) ?? []);
	let autoRefresh = $state(false);
	let refreshing = $state(false);
	let lastUpdated = $state(eventsState[0]?.timestamp ?? new Date().toISOString());
	let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
	let clockNow = $state(Date.now());
	let clockIntervalId: ReturnType<typeof setInterval> | null = null;
	let sourceFilter = $state<'all' | string>('all');
	let statusFilter = $state<'all' | 'success' | 'failed'>('all');
	let periodFilter = $state<'all' | 'today' | 'week' | 'month'>('all');

	const summary = $derived(summaryState);
	const events = $derived(eventsState);
	const availableSources = $derived.by(() => {
		const values = Array.from(new Set(events.map((event) => event.source)));
		return values.sort();
	});
	const filteredEvents = $derived.by(() => {
		return events.filter((event) => {
			if (sourceFilter !== 'all' && event.source !== sourceFilter) return false;
			if (statusFilter === 'success' && !event.success) return false;
			if (statusFilter === 'failed' && event.success) return false;
			if (periodFilter !== 'all' && event.period !== periodFilter) return false;
			return true;
		});
	});
	const filteredSuccessRate = $derived.by(() => {
		if (filteredEvents.length === 0) return 0;
		const successful = filteredEvents.filter((event) => event.success).length;
		return Math.round((successful / filteredEvents.length) * 100);
	});
	const filteredAverageDuration = $derived.by(() => {
		if (filteredEvents.length === 0) return 0;
		return Math.round(filteredEvents.reduce((sum, event) => sum + event.durationMs, 0) / filteredEvents.length);
	});
	const filteredP95Duration = $derived.by(() => {
		if (filteredEvents.length === 0) return 0;
		const sorted = [...filteredEvents].map((event) => event.durationMs).sort((a, b) => a - b);
		const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
		return sorted[idx];
	});
	const offlineEventCount = $derived(filteredEvents.filter((event) => !event.online).length);
	const lastUpdatedRelative = $derived.by(() => {
		const updatedAt = new Date(lastUpdated).getTime();
		const diffSeconds = Math.max(0, Math.floor((clockNow - updatedAt) / 1000));

		if (diffSeconds < 5) return 'just now';
		if (diffSeconds < 60) return `${diffSeconds}s ago`;

		const diffMinutes = Math.floor(diffSeconds / 60);
		if (diffMinutes < 60) return `${diffMinutes}m ago`;

		const diffHours = Math.floor(diffMinutes / 60);
		if (diffHours < 24) return `${diffHours}h ago`;

		const diffDays = Math.floor(diffHours / 24);
		return `${diffDays}d ago`;
	});

	async function refreshTelemetry(): Promise<void> {
		if (refreshing) return;
		refreshing = true;
		try {
			const res = await fetch(`${base}/api/telemetry/refresh?limit=100`);
			if (!res.ok) return;

			const payload = await res.json();
			summaryState = payload.summary ?? summaryState;
			eventsState = payload.events ?? eventsState;
			lastUpdated = new Date().toISOString();
		} catch {
			// Best-effort refresh
		} finally {
			refreshing = false;
		}
	}

	$effect(() => {
		if (!autoRefresh) {
			if (refreshIntervalId) {
				clearInterval(refreshIntervalId);
				refreshIntervalId = null;
			}
			return;
		}

		refreshIntervalId = setInterval(() => {
			void refreshTelemetry();
		}, 5000);

		return () => {
			if (refreshIntervalId) {
				clearInterval(refreshIntervalId);
				refreshIntervalId = null;
			}
		};
	});

	onMount(() => {
		clockIntervalId = setInterval(() => {
			clockNow = Date.now();
		}, 1000);

		return () => {
			if (refreshIntervalId) {
				clearInterval(refreshIntervalId);
				refreshIntervalId = null;
			}
			if (clockIntervalId) {
				clearInterval(clockIntervalId);
				clockIntervalId = null;
			}
		};
	});
</script>

{#if !data.authorized}
	<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
		Unauthorized.
	</div>
{:else}
	<div class="space-y-6">
		<div class="bg-white rounded-2xl shadow-lg p-6">
			<h1 class="text-2xl font-bold text-gray-800">📈 Refresh Telemetry</h1>
			<p class="text-gray-500 mt-1">Admin debug view for dashboard refresh responsiveness</p>
			<div class="mt-3 flex flex-wrap gap-2">
				<a href="{base}/admin" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">← Back to Admin</a>
				<a href="{base}/api/telemetry/refresh?limit=100" class="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm hover:bg-indigo-200 transition-colors">JSON endpoint</a>
				<button
					onclick={() => void refreshTelemetry()}
					disabled={refreshing}
					class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-60 transition-colors"
				>
					{refreshing ? 'Refreshing...' : 'Refresh now'}
				</button>
				<label class="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
					<input type="checkbox" bind:checked={autoRefresh} />
					Auto-refresh (5s)
				</label>
				<span class="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-sm">
					Last updated: {lastUpdatedRelative} ({new Date(lastUpdated).toLocaleTimeString('en-GB')})
				</span>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-4 gap-3">
			<div class="bg-white rounded-xl shadow p-4">
				<div class="text-xs text-gray-500">Shown events</div>
				<div class="text-2xl font-bold text-gray-800">{filteredEvents.length}</div>
			</div>
			<div class="bg-white rounded-xl shadow p-4">
				<div class="text-xs text-gray-500">Success rate (filtered)</div>
				<div class="text-2xl font-bold text-emerald-600">{filteredSuccessRate}%</div>
			</div>
			<div class="bg-white rounded-xl shadow p-4">
				<div class="text-xs text-gray-500">Avg duration (filtered)</div>
				<div class="text-2xl font-bold text-indigo-600">{filteredAverageDuration}ms</div>
			</div>
			<div class="bg-white rounded-xl shadow p-4">
				<div class="text-xs text-gray-500">P95 / offline</div>
				<div class="text-lg font-bold text-gray-800">{filteredP95Duration}ms / {offlineEventCount}</div>
			</div>
		</div>

		<div class="bg-white rounded-xl shadow p-4">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
				<div>
					<label for="sourceFilter" class="block text-xs text-gray-500 mb-1">Source</label>
					<select id="sourceFilter" bind:value={sourceFilter} class="w-full px-3 py-2 border rounded-lg text-sm bg-white">
						<option value="all">All sources</option>
						{#each availableSources as source}
							<option value={source}>{source}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="statusFilter" class="block text-xs text-gray-500 mb-1">Status</label>
					<select id="statusFilter" bind:value={statusFilter} class="w-full px-3 py-2 border rounded-lg text-sm bg-white">
						<option value="all">All status</option>
						<option value="success">Success</option>
						<option value="failed">Failed</option>
					</select>
				</div>
				<div>
					<label for="periodFilter" class="block text-xs text-gray-500 mb-1">Period</label>
					<select id="periodFilter" bind:value={periodFilter} class="w-full px-3 py-2 border rounded-lg text-sm bg-white">
						<option value="all">All periods</option>
						<option value="today">today</option>
						<option value="week">week</option>
						<option value="month">month</option>
					</select>
				</div>
			</div>
		</div>

		<div class="bg-white rounded-xl shadow-lg overflow-hidden">
			<div class="bg-gray-50 px-4 py-3 border-b">
				<h2 class="font-semibold text-gray-700">Latest Events</h2>
			</div>
			{#if filteredEvents.length === 0}
				<div class="p-6 text-sm text-gray-500">No telemetry events yet. Trigger a dashboard refresh and reload this page.</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-3 py-2 text-left text-gray-700">Time</th>
								<th class="px-3 py-2 text-left text-gray-700">Source</th>
								<th class="px-3 py-2 text-left text-gray-700">Duration</th>
								<th class="px-3 py-2 text-left text-gray-700">Period</th>
								<th class="px-3 py-2 text-left text-gray-700">Status</th>
								<th class="px-3 py-2 text-left text-gray-700">Role</th>
								<th class="px-3 py-2 text-left text-gray-700">Online</th>
								<th class="px-3 py-2 text-left text-gray-700">Pending</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{#each filteredEvents as event}
								<tr class="hover:bg-gray-50">
									<td class="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(event.timestamp).toLocaleTimeString('en-GB')}</td>
									<td class="px-3 py-2 text-gray-800">{event.source}</td>
									<td class="px-3 py-2 text-gray-800">{event.durationMs}ms</td>
									<td class="px-3 py-2 text-gray-800">{event.period}</td>
									<td class="px-3 py-2">
										<span class="px-2 py-0.5 rounded text-xs font-medium {event.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">
											{event.success ? 'success' : 'failed'}
										</span>
									</td>
									<td class="px-3 py-2 text-gray-800">{event.role || '-'}</td>
									<td class="px-3 py-2 text-gray-800">{event.online ? 'yes' : 'no'}</td>
									<td class="px-3 py-2 text-gray-800">{event.pendingOfflineCount}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<div class="bg-white rounded-xl shadow-lg overflow-hidden">
			<div class="bg-gray-50 px-4 py-3 border-b">
				<h2 class="font-semibold text-gray-700">By Source</h2>
			</div>
			{#if Object.keys(summary.bySource).length === 0}
				<div class="p-6 text-sm text-gray-500">No source data yet.</div>
			{:else}
				<div class="divide-y">
					{#each Object.entries(summary.bySource) as [source, value]}
						<div class="px-4 py-3 flex items-center justify-between">
							<div class="font-medium text-gray-800">{source}</div>
							<div class="text-sm text-gray-600">{value.count} events · {value.avgDurationMs}ms avg</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
