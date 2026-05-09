<script lang="ts">
	interface Props {
		icon: string;
		title: string;
		value: string;
		sub?: string;
		severity?: 'good' | 'warning' | 'neutral';
	}

	let { icon, title, value, sub, severity = 'neutral' }: Props = $props();

	const borderColor = $derived(
		severity === 'good'
			? 'border-green-500'
			: severity === 'warning'
				? 'border-amber-400'
				: 'border-gray-300 dark:border-gray-600'
	);

	const valueColor = $derived(
		severity === 'good'
			? 'text-green-600 dark:text-green-400'
			: severity === 'warning'
				? 'text-amber-600 dark:text-amber-400'
				: 'text-gray-800 dark:text-white'
	);
</script>

<div
	class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 p-4 transition-colors duration-200 {borderColor}"
>
	<div class="flex items-center gap-2 mb-2">
		<span class="text-base">{icon}</span>
		<span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"
			>{title}</span
		>
	</div>
	<div class="text-2xl font-bold {valueColor}">{value}</div>
	{#if sub}
		<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</div>
	{/if}
</div>
