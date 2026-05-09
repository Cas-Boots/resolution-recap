<script lang="ts">
	let { current, longest }: { current: number; longest: number } = $props();

	const colorClass = $derived.by(() => {
		if (current === 0) return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
		if (current >= 30) return 'bg-gradient-to-r from-rose-500 to-amber-500 text-white';
		if (current >= 14) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
		if (current >= 7)  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
		return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
	});

	// Mark when current streak equals the all-time longest (personal best run)
	const isPB = $derived(current > 0 && current === longest && longest > 0);
</script>

{#if current > 0}
	<span
		class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold {colorClass}"
		title="Current: {current}d · Longest: {longest}d"
	>
		🔥 {current}d{isPB ? ' ★' : ''}
	</span>
{/if}
