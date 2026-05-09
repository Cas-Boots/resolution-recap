<script lang="ts">
	interface Best {
		type: string;
		value: number;
		date?: string;
		details?: string;
	}

	interface Props {
		bests: Best[];
	}

	let { bests }: Props = $props();

	function labelFor(type: string): { emoji: string; label: string; unit: string } {
		switch (type) {
			case 'best_day':
				return { emoji: '🏆', label: 'Best Day', unit: 'entries' };
			case 'best_week':
				return { emoji: '📅', label: 'Best Week', unit: 'entries' };
			case 'best_month':
				return { emoji: '🗓️', label: 'Best Month', unit: 'entries' };
			case 'longest_gap':
				return { emoji: '😴', label: 'Longest Gap', unit: 'days' };
			default:
				return { emoji: '📊', label: type, unit: '' };
		}
	}
</script>

{#if bests.length > 0}
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
		{#each bests as best}
			{@const info = labelFor(best.type)}
			<div
				class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-center shadow-sm transition-colors duration-200"
			>
				<div class="text-2xl mb-1">{info.emoji}</div>
				<div class="text-xl font-bold text-indigo-600 dark:text-indigo-400">{best.value}</div>
				<div class="text-xs text-gray-500 dark:text-gray-400">{info.unit}</div>
				<div class="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">{info.label}</div>
				{#if best.date}
					<div class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{best.date}</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
