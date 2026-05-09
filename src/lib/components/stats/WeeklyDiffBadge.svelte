<script lang="ts">
	let { thisWeek, lastWeek }: { thisWeek: number; lastWeek: number } = $props();

	const diff = $derived(thisWeek - lastWeek);
	const show = $derived(!(lastWeek === 0 && thisWeek === 0));

	const label = $derived.by(() => {
		if (lastWeek === 0 && thisWeek > 0) return `↑ +${thisWeek} (new)`;
		if (diff === 0) return '· 0%';
		const pct = Math.round((diff / lastWeek) * 100);
		const sign = diff > 0 ? '+' : '';
		const arrow = diff > 0 ? '↑' : '↓';
		return `${arrow} ${sign}${diff} (${sign}${pct}%)`;
	});

	const colorClass = $derived.by(() => {
		if (diff > 0 || (lastWeek === 0 && thisWeek > 0)) {
			return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
		}
		if (diff < 0) return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
		return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
	});
</script>

{#if show}
	<span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold {colorClass}">
		{label}
	</span>
{/if}
