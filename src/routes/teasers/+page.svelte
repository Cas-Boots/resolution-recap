<script lang="ts">
	import type { PageData } from './$types';
	import { base } from '$app/paths';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let copiedIndex = $state<number | null>(null);
	let filterCategory = $state<string>('all');

	const categories = [
		{ value: 'all', label: 'All', emoji: '📋' },
		{ value: 'aggregate', label: 'Group Stats', emoji: '📊' },
		{ value: 'streak', label: 'Streaks', emoji: '🔥' },
		{ value: 'milestone', label: 'Milestones', emoji: '🎯' },
		{ value: 'movement', label: 'Rankings', emoji: '🏁' },
		{ value: 'mystery', label: 'Cryptic', emoji: '🤫' },
		{ value: 'challenge', label: 'Challenges', emoji: '💪' }
	];

	const filteredTeasers = $derived(
		filterCategory === 'all' 
			? data.teasers 
			: data.teasers?.filter(t => t.category === filterCategory) || []
	);

	async function copyToClipboard(text: string, index: number) {
		try {
			await navigator.clipboard.writeText(text);
			copiedIndex = index;
			setTimeout(() => {
				copiedIndex = null;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	function getCategoryColor(category: string): string {
		switch (category) {
			case 'aggregate': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
			case 'streak': return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
			case 'milestone': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
			case 'movement': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
			case 'mystery': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
			case 'challenge': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
			default: return 'bg-gray-100 text-gray-700';
		}
	}
</script>

<div class="space-y-6">
	<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
		<h1 class="text-2xl font-bold text-gray-800 dark:text-white mb-2">📱 WhatsApp Teasers</h1>
		<p class="text-gray-500 dark:text-gray-400">
			Share these cryptic messages in your group chat without revealing who's who!
		</p>
	</div>

	{#if data.stats}
		<!-- Quick Stats (for your reference only) -->
		<div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
			<h2 class="text-lg font-bold mb-4 opacity-90">📊 Your Reference Stats</h2>
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
				<div class="bg-white/10 rounded-xl p-3">
					<div class="text-2xl font-bold">{data.stats.totalEntries}</div>
					<div class="text-xs opacity-80">Total Entries</div>
				</div>
				<div class="bg-white/10 rounded-xl p-3">
					<div class="text-2xl font-bold">{data.stats.todayEntries}</div>
					<div class="text-xs opacity-80">Today</div>
				</div>
				<div class="bg-white/10 rounded-xl p-3">
					<div class="text-2xl font-bold">{data.stats.weekEntries}</div>
					<div class="text-xs opacity-80">This Week</div>
				</div>
				<div class="bg-white/10 rounded-xl p-3">
					<div class="text-2xl font-bold">🔥 {data.stats.maxStreak}</div>
					<div class="text-xs opacity-80">Best Streak</div>
				</div>
			</div>
			<p class="text-xs mt-4 opacity-60 text-center">This info is for you only - don't share these exact numbers!</p>
		</div>
	{/if}

	<!-- Category Filter -->
	<div class="flex flex-wrap gap-2">
		{#each categories as cat}
			<button
				onclick={() => filterCategory = cat.value}
				class="px-4 py-2 rounded-full text-sm font-medium transition-all {filterCategory === cat.value 
					? 'bg-indigo-600 text-white shadow-lg' 
					: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
			>
				{cat.emoji} {cat.label}
			</button>
		{/each}
	</div>

	<!-- Teaser Cards -->
	{#if filteredTeasers.length === 0}
		<div class="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400">
			No teasers available for this category yet. Log more entries to unlock more teasers!
		</div>
	{:else}
		<div class="space-y-4">
			{#each filteredTeasers as teaser, i}
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
					<div class="p-4">
						<div class="flex items-start gap-3">
							<span class="text-3xl">{teaser.emoji}</span>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<span class="px-2 py-0.5 rounded-full text-xs font-medium {getCategoryColor(teaser.category)}">
										{teaser.category}
									</span>
								</div>
								<p class="text-gray-800 dark:text-white font-medium">{teaser.message}</p>
							</div>
						</div>
					</div>
					
					<!-- Preview of WhatsApp message -->
					<div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-t dark:border-gray-600">
						<div class="text-xs text-gray-500 dark:text-gray-400 mb-2">WhatsApp preview:</div>
						<div class="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap font-sans">
							{teaser.copyText}
						</div>
					</div>
					
					<div class="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600">
						<button
							onclick={() => copyToClipboard(teaser.copyText, i)}
							class="w-full py-2 rounded-lg font-medium transition-all {copiedIndex === i 
								? 'bg-green-500 text-white' 
								: 'bg-indigo-600 text-white hover:bg-indigo-700'}"
						>
							{copiedIndex === i ? '✅ Copied!' : '📋 Copy for WhatsApp'}
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Custom Teaser Creator -->
	<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
		<h2 class="text-lg font-bold text-gray-800 dark:text-white mb-4">✏️ Custom Templates</h2>
		<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
			Use these templates to create your own teasers. Fill in the blanks!
		</p>
		
		<div class="space-y-3">
			{#each [
				'🎯 *Update*\n\nEr is weer gelogd! Wie zou het zijn? 🤔',
				'🔥 *Streak Watch*\n\nIemand is lekker aan het builden... 💪',
				'📊 *Tussenstand*\n\nDe strijd is nog lang niet gestreden! Alles is nog mogelijk... 👀',
				'⚡ *Plot Twist*\n\nEr zijn wat verrassende bewegingen in de rankings! 😱',
				'🏆 *Reminder*\n\nVergeet niet te loggen vandaag! Elke entry telt! 🙌',
				'🎲 *Random Fact*\n\nWist je dat we als groep al [X] entries hebben? 🎉'
			] as template, i}
				<button
					onclick={() => copyToClipboard(template, 100 + i)}
					class="w-full text-left bg-gray-50 dark:bg-gray-700 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group"
				>
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{template}</span>
						<span class="text-gray-400 group-hover:text-indigo-500 transition-colors shrink-0 ml-2">
							{copiedIndex === 100 + i ? '✅' : '📋'}
						</span>
					</div>
				</button>
			{/each}
		</div>
	</div>

	<!-- Tips -->
	<div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
		<h3 class="font-semibold text-amber-800 dark:text-amber-200 mb-2">💡 Tips for Maximum Intrigue</h3>
		<ul class="text-sm text-amber-700 dark:text-amber-300 space-y-1">
			<li>• Share 1-2 teasers per day max - keep them wanting more!</li>
			<li>• Mix up the categories - don't always use the same type</li>
			<li>• Add your own spin to make it feel personal</li>
			<li>• Never confirm or deny guesses about who it is 🤫</li>
			<li>• Save the juicy reveals for the end-of-year presentation!</li>
		</ul>
	</div>
</div>
