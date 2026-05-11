<script lang="ts">
	import type { Metric, Person } from '$lib/server/db';
	import { locale } from '$lib/stores/locale.svelte';
	import { translateMetric } from '$lib/i18n';

	interface Comparison {
		personId: number;
		personName: string;
		personEmoji: string;
		metrics: Record<string, number>;
		total: number;
	}

	interface Props {
		comparisons: Comparison[];
		metrics: Metric[];
		person: Person;
		totalEntries: number;
		metricTotals: Record<string, number>;
	}

	let { comparisons, metrics, person, totalEntries, metricTotals }: Props = $props();

	function getTranslatedMetricName(metric: string | { name: string; name_nl?: string | null }): string {
		if (typeof metric === 'string') {
			return translateMetric(metric, locale);
		}
		return translateMetric(metric.name, locale, metric.name_nl);
	}

	let compareWith = $state<number | null>(null);

	const comparisonData = $derived.by(() => {
		if (!compareWith || !comparisons) return null;
		return comparisons.find(c => c.personId === compareWith);
	});
</script>

<!-- Head-to-Head Comparison -->
<div class="bg-white rounded-xl shadow-lg p-4">
	<h2 class="font-semibold text-gray-800 mb-4">⚔️ Head-to-Head Comparison</h2>

	<div class="mb-4">
		<p class="text-sm text-gray-600 mb-2">Compare with:</p>
		<div class="flex flex-wrap gap-2">
			{#each comparisons as other}
				<button
					onclick={() => compareWith = other.personId}
					class="px-4 py-2 rounded-lg transition-colors {compareWith === other.personId ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
				>
					{other.personEmoji} {other.personName}
				</button>
			{/each}
		</div>
	</div>

	{#if compareWith && comparisonData}
		<div class="space-y-4">
			<!-- Total comparison -->
			<div class="p-4 bg-gray-50 rounded-lg">
				<div class="text-center text-sm text-gray-600 mb-2">Total Entries</div>
				<div class="flex items-center justify-between">
					<div class="text-center flex-1">
						<div class="text-3xl mb-1">{person.emoji}</div>
						<div class="text-2xl font-bold text-indigo-600">{totalEntries}</div>
					</div>
					<div class="text-2xl font-bold text-gray-400">vs</div>
					<div class="text-center flex-1">
						<div class="text-3xl mb-1">{comparisonData.personEmoji}</div>
						<div class="text-2xl font-bold text-indigo-600">{comparisonData.total}</div>
					</div>
				</div>
				{#if true}
					{@const diff = totalEntries - comparisonData.total}
					<div class="text-center mt-2 text-sm {diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-500'}">
						{#if diff > 0}
							{person.name} is ahead by {diff}
						{:else if diff < 0}
							{comparisonData.personName} is ahead by {Math.abs(diff)}
						{:else}
							It's a tie!
						{/if}
					</div>
				{/if}
			</div>

			<!-- Per-metric comparison -->
			{#each metrics as metric}
				{@const myCount = metricTotals[metric.name] || 0}
				{@const theirCount = comparisonData.metrics[metric.name] || 0}
				{@const maxOfTwo = Math.max(myCount, theirCount, 1)}
				<div class="p-4 bg-gray-50 rounded-lg">
					<div class="flex items-center gap-2 mb-3">
						<span class="text-xl">{metric.emoji}</span>
						<span class="font-medium">{getTranslatedMetricName(metric)}</span>
					</div>
					<div class="space-y-2">
						<div class="flex items-center gap-2">
							<span class="w-20 text-sm">{person.name}</span>
							<div class="flex-1 h-6 bg-gray-200 rounded overflow-hidden">
								<div
									class="h-full bg-indigo-500"
									style="width: {(myCount / maxOfTwo) * 100}%"
								></div>
							</div>
							<span class="w-8 text-right font-medium">{myCount}</span>
						</div>
						<div class="flex items-center gap-2">
							<span class="w-20 text-sm">{comparisonData.personName}</span>
							<div class="flex-1 h-6 bg-gray-200 rounded overflow-hidden">
								<div
									class="h-full bg-pink-500"
									style="width: {(theirCount / maxOfTwo) * 100}%"
								></div>
							</div>
							<span class="w-8 text-right font-medium">{theirCount}</span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-center text-gray-500 py-8">
			Select someone to compare with
		</div>
	{/if}
</div>
