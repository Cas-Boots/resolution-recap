<script lang="ts">
	interface DayStat {
		day: string;
		dayIndex: number;
		count: number;
		percentage: number;
	}

	interface Props {
		stats: DayStat[];
	}

	let { stats }: Props = $props();

	const maxCount = $derived(Math.max(...stats.map((d) => d.count), 1));

	// Sort by dayIndex so order is always Mon–Sun regardless of input order
	const ordered = $derived([...stats].sort((a, b) => a.dayIndex - b.dayIndex));
</script>

{#if stats.length > 0}
	<div class="flex items-end justify-between gap-1 h-48 px-1">
		{#each ordered as day}
			{@const heightPct = (day.count / maxCount) * 100}
			<div class="flex flex-col items-center flex-1 min-w-0 h-full">
				<!-- count label -->
				<div class="text-xs text-gray-500 dark:text-gray-400 mb-1 min-h-[1rem]">
					{#if day.count > 0}
						{day.count}
					{/if}
				</div>
				<!-- bar column: grow to fill remaining vertical space -->
				<div class="flex-1 w-full flex items-end">
					<div
						class="w-full rounded-t-sm bg-indigo-500 dark:bg-indigo-400 transition-all duration-500"
						style="height: {heightPct}%"
					></div>
				</div>
				<!-- day label -->
				<div class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate w-full text-center">
					{day.day.substring(0, 3)}
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">No data yet</div>
{/if}
