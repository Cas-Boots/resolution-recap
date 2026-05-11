<script lang="ts">
	import type { Metric, Season } from '$lib/server/db';
	import { getLocale } from '$lib/stores/locale.svelte';
	import type { Locale } from '$lib/i18n';

	const locale = $derived(getLocale());
	import { translateMetric } from '$lib/i18n';

	interface Props {
		calendarData: Record<string, { total: number; byMetric: Record<string, number> }>;
		metrics: Metric[];
		season: Season;
	}

	let { calendarData, metrics, season }: Props = $props();

	function getTranslatedMetricName(metric: string | { name: string; name_nl?: string | null }): string {
		if (typeof metric === 'string') {
			return translateMetric(metric, locale);
		}
		return translateMetric(metric.name, locale, metric.name_nl);
	}

	let selectedMetric = $state<string>('all');

	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	const calendarGrid = $derived.by(() => {
		const year = season.year;
		const weeks: { date: string; count: number; dayOfWeek: number; month: number }[][] = [];

		const startDate = new Date(year, 0, 1);
		const endDate = new Date(year, 11, 31);

		const firstDay = startDate.getDay();
		const adjustedStart = new Date(startDate);
		adjustedStart.setDate(adjustedStart.getDate() - firstDay);

		let currentWeek: { date: string; count: number; dayOfWeek: number; month: number }[] = [];
		let current = new Date(adjustedStart);

		while (current <= endDate || currentWeek.length > 0) {
			const dateStr = current.toISOString().split('T')[0];
			const isInYear = current.getFullYear() === year;

			let count = 0;
			if (isInYear && calendarData && calendarData[dateStr]) {
				if (selectedMetric === 'all') {
					count = calendarData[dateStr].total;
				} else {
					count = calendarData[dateStr].byMetric[selectedMetric] || 0;
				}
			}

			currentWeek.push({
				date: dateStr,
				count: isInYear ? count : -1,
				dayOfWeek: current.getDay(),
				month: current.getMonth()
			});

			if (currentWeek.length === 7) {
				weeks.push(currentWeek);
				currentWeek = [];
			}

			current.setDate(current.getDate() + 1);

			if (current > endDate && currentWeek.length === 0) break;
		}

		return weeks;
	});

	const maxCount = $derived.by(() => {
		let max = 1;
		for (const week of calendarGrid) {
			for (const day of week) {
				if (day.count > max) max = day.count;
			}
		}
		return max;
	});

	function getHeatColor(count: number): string {
		if (count < 0) return 'bg-transparent';
		if (count === 0) return 'bg-gray-100';
		const intensity = Math.min(count / maxCount, 1);
		if (intensity <= 0.25) return 'bg-green-200';
		if (intensity <= 0.5) return 'bg-green-400';
		if (intensity <= 0.75) return 'bg-green-500';
		return 'bg-green-600';
	}
</script>

<!-- Calendar Heatmap -->
<div class="bg-white rounded-xl shadow-lg p-4">
	<div class="flex items-center justify-between mb-4">
		<h2 class="font-semibold text-gray-800">📅 Activity Calendar</h2>
		<select
			bind:value={selectedMetric}
			class="px-3 py-1 border rounded-lg text-sm"
		>
			<option value="all">All Metrics</option>
			{#each metrics as metric}
				<option value={metric.name}>{metric.emoji} {getTranslatedMetricName(metric)}</option>
			{/each}
		</select>
	</div>

	{#if calendarGrid.length === 0}
		<div class="text-center text-gray-500 py-8">
			No calendar data available
		</div>
	{:else}
		<div class="overflow-x-auto">
			<div class="min-w-[700px]">
				<!-- Month labels -->
				<div class="flex mb-1">
					<div class="w-8"></div>
					{#each monthNames as month, i}
						{@const weekIndex = calendarGrid.findIndex(week => week.some(d => d.month === i && d.count >= 0))}
						{#if weekIndex >= 0}
							<div
								class="text-xs text-gray-500"
								style="position: absolute; left: {32 + weekIndex * 14}px"
							>
								{month}
							</div>
						{/if}
					{/each}
				</div>

				<!-- Day labels + Grid -->
				<div class="flex mt-4">
					<div class="flex flex-col gap-0.5 mr-1 text-xs text-gray-400">
						{#each dayNames as day, i}
							{#if i % 2 === 1}
								<div class="h-3 flex items-center">{day}</div>
							{:else}
								<div class="h-3"></div>
							{/if}
						{/each}
					</div>
					<div class="flex gap-0.5">
						{#each calendarGrid as week}
							<div class="flex flex-col gap-0.5">
								{#each week as day}
									<div
										class="w-3 h-3 rounded-sm {getHeatColor(day.count)}"
										title="{day.date}: {day.count >= 0 ? day.count : 'N/A'} entries"
									></div>
								{/each}
							</div>
						{/each}
					</div>
				</div>

				<!-- Legend -->
				<div class="flex items-center gap-2 mt-4 text-xs text-gray-500">
					<span>Less</span>
					<div class="w-3 h-3 bg-gray-100 rounded-sm"></div>
					<div class="w-3 h-3 bg-green-200 rounded-sm"></div>
					<div class="w-3 h-3 bg-green-400 rounded-sm"></div>
					<div class="w-3 h-3 bg-green-500 rounded-sm"></div>
					<div class="w-3 h-3 bg-green-600 rounded-sm"></div>
					<span>More</span>
				</div>
			</div>
		</div>
	{/if}
</div>
