<script lang="ts">
	import type { PageData } from './$types';
	import { base } from '$app/paths';

	interface Props { data: PageData; }
	let { data }: Props = $props();

	function borderColor(status: string) {
		if (status === 'healthy') return 'border-green-400';
		if (status === 'warning') return 'border-amber-400';
		return 'border-red-400';
	}

	function statusDotColor(status: string) {
		if (status === 'healthy') return 'bg-green-400';
		if (status === 'warning') return 'bg-amber-400';
		return 'bg-red-400';
	}

	function lastEntryLabel(daysSince: number | null) {
		if (daysSince === null) return 'No entries yet';
		if (daysSince === 0) return 'Last entry: today';
		if (daysSince === 1) return 'Last entry: yesterday';
		return `Last entry: ${daysSince} days ago`;
	}
</script>

<div class="space-y-6">
	{#if !data.authorized}
		<div class="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
			<h1 class="text-xl font-bold">Access Denied</h1>
			<p class="mt-1 text-sm">You do not have permission to view this page.</p>
		</div>
	{:else if !data.season}
		<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-800">
			<h1 class="text-xl font-bold">No Active Season</h1>
			<p class="mt-1 text-sm">Please activate a season from the admin panel first.</p>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
			<h1 class="text-2xl font-bold text-gray-800 dark:text-white">👥 Participants — {data.season.name}</h1>
			<p class="text-gray-500 dark:text-gray-400 mt-1">Performance overview for all active participants</p>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each data.participants as p}
				<a href="{base}/person/{p.id}" class="block">
					<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5 hover:shadow-md transition-shadow border-l-4 {borderColor(p.status)}">

						<!-- Header row: emoji + name + status dot -->
						<div class="flex items-center gap-3 mb-3">
							<span class="text-3xl">{p.emoji}</span>
							<div class="flex-1">
								<div class="font-bold text-gray-800 dark:text-white">{p.name}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">
									{lastEntryLabel(p.daysSinceLastEntry)}
								</div>
							</div>
							<!-- Status indicator -->
							<div class="w-3 h-3 rounded-full {statusDotColor(p.status)}"></div>
						</div>

						<!-- Stats grid: 2x2 -->
						<div class="grid grid-cols-2 gap-2 text-sm">
							<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
								<div class="font-bold text-indigo-600 dark:text-indigo-400 text-lg">{p.totalEntries}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">entries</div>
							</div>
							<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
								<div class="font-bold text-orange-500 text-lg">{p.currentStreak}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">day streak</div>
							</div>
							{#if p.consistencyPercentage !== null}
								<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
									<div class="font-bold text-gray-800 dark:text-white text-lg">{p.consistencyPercentage}%</div>
									<div class="text-xs text-gray-500 dark:text-gray-400">consistency</div>
								</div>
							{/if}
							{#if p.goalCompletion !== null}
								<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
									<div class="font-bold {p.goalCompletion >= 100 ? 'text-green-600' : 'text-gray-800 dark:text-white'} text-lg">{p.goalCompletion}%</div>
									<div class="text-xs text-gray-500 dark:text-gray-400">goal</div>
								</div>
							{/if}
						</div>

						<!-- Streak warning badge -->
						{#if p.hasStreakWarning}
							<div class="mt-2 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded px-2 py-1">
								⚠️ Streak at risk today!
							</div>
						{/if}

						<!-- Prediction -->
						{#if p.prediction}
							<div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
								Projected: {p.prediction.projected_final} total ({p.prediction.confidence} confidence)
							</div>
						{/if}

						<!-- View link indicator -->
						<div class="mt-3 text-xs text-indigo-500 dark:text-indigo-400 text-right">
							View insights →
						</div>

					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
