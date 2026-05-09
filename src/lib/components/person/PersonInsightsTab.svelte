<script lang="ts">
	import type { Metric } from '$lib/server/db';
	import PersonProgressChart from './PersonProgressChart.svelte';
	import PersonSportMix from './PersonSportMix.svelte';
	import PersonDayOfWeek from './PersonDayOfWeek.svelte';
	import PersonBestsCard from './PersonBestsCard.svelte';

	interface Props {
		cumulativeStats: { date: string; cumulative: number; expected: number }[];
		seasonYear: number;
		personName: string;
		personEmoji: string;
		sportCounts: { tag: string; count: number }[];
		dayOfWeekStats: { day: string; dayIndex: number; count: number; percentage: number }[];
		personalBests: { type: string; value: number; date?: string; details?: string }[];
		metrics: Metric[];
	}

	let {
		cumulativeStats,
		seasonYear,
		personName,
		personEmoji,
		sportCounts,
		dayOfWeekStats,
		personalBests,
		metrics
	}: Props = $props();

	const hasCumulativeData = $derived(cumulativeStats.length > 0);
	const hasSportCounts = $derived(sportCounts.length > 0);
	const hasDayOfWeek = $derived(dayOfWeekStats.some((d) => d.count > 0));
	const hasPersonalBests = $derived(personalBests.length > 0);

	const hasAnyData = $derived(
		hasCumulativeData || hasSportCounts || hasDayOfWeek || hasPersonalBests
	);
</script>

{#if !hasAnyData}
	<div class="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500 text-sm">
		No data yet — start logging entries!
	</div>
{:else}
	<div class="space-y-6">
		<!-- Section 1: Cumulative progress chart -->
		{#if hasCumulativeData}
			<div>
				<h2 class="font-semibold text-gray-800 dark:text-white mb-3">📈 Season Progress</h2>
				<PersonProgressChart
					{cumulativeStats}
					{seasonYear}
					{personName}
					{personEmoji}
				/>
			</div>
		{/if}

		<!-- Section 2: Sport mix -->
		{#if hasSportCounts}
			<div>
				<h2 class="font-semibold text-gray-800 dark:text-white mb-3">🏃 Sport Breakdown</h2>
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 transition-colors duration-200">
					<PersonSportMix {sportCounts} />
				</div>
			</div>
		{/if}

		<!-- Section 3: Day of week -->
		{#if hasDayOfWeek}
			<div>
				<h2 class="font-semibold text-gray-800 dark:text-white mb-3">📅 Most Active Days</h2>
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 transition-colors duration-200">
					<PersonDayOfWeek stats={dayOfWeekStats} />
				</div>
			</div>
		{/if}

		<!-- Section 4: Personal bests -->
		{#if hasPersonalBests}
			<div>
				<h2 class="font-semibold text-gray-800 dark:text-white mb-3">🏆 Personal Bests</h2>
				<PersonBestsCard bests={personalBests} />
			</div>
		{/if}
	</div>
{/if}
