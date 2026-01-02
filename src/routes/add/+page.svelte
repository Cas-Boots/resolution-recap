<script lang="ts">
	import type { PageData } from './$types';
	import { goto, invalidateAll } from '$app/navigation';
	import { base } from '$app/paths';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Predefined sport activity types
	const SPORT_ACTIVITIES = [
		{ value: 'running', label: '🏃 Running' },
		{ value: 'cycling', label: '🚴 Cycling' },
		{ value: 'swimming', label: '🏊 Swimming' },
		{ value: 'gym', label: '🏋️ Gym' },
		{ value: 'yoga', label: '🧘 Yoga' },
		{ value: 'hiking', label: '🥾 Hiking' },
		{ value: 'tennis', label: '🎾 Tennis' },
		{ value: 'padel', label: '🎾 Padel' },
		{ value: 'football', label: '⚽ Football' },
		{ value: 'basketball', label: '🏀 Basketball' },
		{ value: 'hockey', label: '🏑 Hockey' },
		{ value: 'volleyball', label: '🏐 Volleyball' },
		{ value: 'climbing', label: '🧗 Climbing' },
		{ value: 'skiing', label: '⛷️ Skiing' },
		{ value: 'skating', label: '⛸️ Skating' },
		{ value: 'boxing', label: '🥊 Boxing' },
		{ value: 'martial-arts', label: '🥋 Martial Arts' },
		{ value: 'dance', label: '💃 Dance' },
		{ value: 'other', label: '🏅 Other' }
	];

	// Emoji mapping for metrics
	const METRIC_EMOJIS: Record<string, string> = {
		'sporting': '🏃',
		'reading': '📚',
		'meditating': '🧘',
		'meditation': '🧘',
		'journaling': '📝',
		'cooking': '👨‍🍳',
		'learning': '🎓',
		'exercise': '💪',
		'walking': '🚶',
		'sleeping': '😴',
		'water': '💧',
		'healthy eating': '🥗',
		'no alcohol': '🚫🍺',
		'no smoking': '🚫🚬',
		'gratitude': '🙏',
		'creative': '🎨',
		'social': '👫',
		'outdoors': '🌳',
		'music': '🎵',
		'writing': '✍️',
		'cakes eaten': '🍰'
	};

	function getMetricEmoji(metricName: string): string {
		const lower = metricName.toLowerCase();
		return METRIC_EMOJIS[lower] || '✅';
	}

	let personId = $state<number | null>(null);
	let metricId = $state<number | null>(null);
	let entryDate = $state(data.today || new Date().toISOString().split('T')[0]);
	let notes = $state('');
	let selectedTags = $state<string[]>([]);
	let loading = $state(false);
	let error = $state('');
	let success = $state(false);
	let duplicateWarning = $state<{ personName: string; metricName: string; tags?: string } | null>(null);
	let skipDuplicateCheck = $state(false);
	let lastEntry = $state<{ id: number; personName: string; metricName: string; date: string } | null>(null);
	let unlockedAchievements = $state<Array<{ key: string; name: string; emoji: string; description: string }>>([]);
	let showAchievementCelebration = $state(false);

	// Season date bounds
	let seasonMinDate = $derived(() => {
		if (!data.season?.year) return undefined;
		return `${data.season.year}-01-01`;
	});
	let seasonMaxDate = $derived(() => {
		if (!data.season?.year) return undefined;
		return `${data.season.year}-12-31`;
	});

	// Helper to check if a date is within the season
	function isDateInSeason(daysAgo: number): boolean {
		if (!data.season?.year) return true;
		const d = new Date();
		d.setDate(d.getDate() - daysAgo);
		return d.getFullYear() === data.season.year;
	}

	function getDateDaysAgo(daysAgo: number): string {
		const d = new Date();
		d.setDate(d.getDate() - daysAgo);
		return d.toISOString().split('T')[0];
	}

	// Check if the selected metric is "Sporting"
	let isSportingMetric = $derived(() => {
		if (!metricId) return false;
		const metric = data.metrics?.find(m => m.id === metricId);
		return metric?.name?.toLowerCase() === 'sporting';
	});

	// Check for duplicates when person, metric, or date changes
	async function checkForDuplicate() {
		if (!personId || !metricId || !entryDate) {
			duplicateWarning = null;
			return;
		}
		
		try {
			const res = await fetch(`${base}/api/entries/check-duplicate?personId=${personId}&metricId=${metricId}&entryDate=${entryDate}`);
			if (res.ok) {
				const data = await res.json();
				if (data.isDuplicate && data.existing) {
					duplicateWarning = {
						personName: data.existing.personName,
						metricName: data.existing.metricName,
						tags: data.existing.tags
					};
				} else {
					duplicateWarning = null;
				}
			}
		} catch {
			// Ignore errors
		}
		skipDuplicateCheck = false;
	}

	// Trigger duplicate check when selection changes
	$effect(() => {
		if (personId && metricId && entryDate) {
			checkForDuplicate();
		}
	});

	function toggleTag(tag: string) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter(t => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!personId || !metricId || !entryDate) {
			error = 'Please fill in all required fields';
			return;
		}

		// Validate date is within season
		if (data.season?.year) {
			const entryYear = new Date(entryDate).getFullYear();
			if (entryYear !== data.season.year) {
				error = `Date must be within the ${data.season.year} season`;
				return;
			}
		}

		loading = true;
		error = '';

		try {
			const res = await fetch(`${base}/api/entries`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					personId,
					metricId,
					entryDate,
					notes: notes.trim() || undefined,
					tags: selectedTags.length > 0 ? selectedTags.join(',') : undefined
				})
			});

			if (res.ok) {
				const result = await res.json();
				success = true;
				
				// Store last entry for undo
				const person = data.people?.find(p => p.id === personId);
				const metric = data.metrics?.find(m => m.id === metricId);
				lastEntry = {
					id: result.id,
					personName: person?.name || 'Unknown',
					metricName: metric?.name || 'Unknown',
					date: entryDate
				};
				
				// Show achievement celebration if any unlocked
				if (result.newAchievements && result.newAchievements.length > 0) {
					unlockedAchievements = result.newAchievements;
					showAchievementCelebration = true;
					setTimeout(() => {
						showAchievementCelebration = false;
						unlockedAchievements = [];
					}, 5000);
				}
				
				// Reset form for quick successive entries
				personId = null;
				metricId = null;
				notes = '';
				selectedTags = [];
				// Keep date the same for convenience
				
				setTimeout(() => {
					success = false;
				}, 2000);
				
				await invalidateAll();
			} else {
				const data = await res.json();
				error = data.error || 'Failed to add entry';
			}
		} catch {
			error = 'Connection error';
		} finally {
			loading = false;
		}
	}
</script>

<!-- Achievement Celebration Overlay -->
{#if showAchievementCelebration && unlockedAchievements.length > 0}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
	<div class="fixed inset-0 bg-black/60 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Achievement unlocked" tabindex="-1" onclick={() => showAchievementCelebration = false}>
		<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
		<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-indigo-500/20 p-8 max-w-sm w-full text-center transform animate-bounce-in dark:border dark:border-gray-700" onclick={(e) => e.stopPropagation()}>
			<div class="text-6xl mb-4">🎉</div>
			<h2 class="text-2xl font-bold text-gray-800 dark:text-white mb-2">Achievement Unlocked!</h2>
			{#each unlockedAchievements as achievement}
				<div class="bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-amber-900/40 dark:to-yellow-900/40 rounded-xl p-4 mb-3 dark:border dark:border-amber-700/30">
					<div class="text-4xl mb-2">{achievement.emoji}</div>
					<div class="font-bold text-lg text-amber-800 dark:text-amber-300">{achievement.name}</div>
					<div class="text-sm text-amber-700 dark:text-amber-400">{achievement.description}</div>
				</div>
			{/each}
			<button onclick={() => showAchievementCelebration = false} class="mt-4 px-6 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 shadow-lg shadow-indigo-500/25 dark:shadow-indigo-500/40 transition-colors">Awesome!</button>
		</div>
	</div>
{/if}

<div class="space-y-6">
	<div class="bg-white dark:bg-gray-800/90 dark:backdrop-blur-sm rounded-2xl shadow-lg dark:shadow-indigo-500/10 p-6 dark:border dark:border-gray-700/50">
		<h1 class="text-2xl font-bold text-gray-800 dark:text-white mb-1">➕ Add Entry</h1>
		{#if data.season}
			<p class="text-gray-500 dark:text-gray-400">{data.season.name}</p>
		{/if}
	</div>

	{#if !data.season}
		<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800">
			No active season. Ask an admin to set one up.
		</div>
	{:else}
		<form onsubmit={handleSubmit} class="bg-white dark:bg-gray-800/90 dark:backdrop-blur-sm rounded-xl shadow-lg dark:shadow-indigo-500/10 p-6 space-y-5 dark:border dark:border-gray-700/50">
			<!-- Person -->
			<div>
				<p class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Who?</p>
				<div class="flex flex-wrap gap-2" role="group" aria-label="Person selection">
					{#each data.people || [] as person}
						<button
							type="button"
							onclick={() => personId = person.id}
							class="px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 border-2 {personId === person.id 
								? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-400 shadow-lg shadow-indigo-500/40' 
								: 'bg-white dark:bg-gray-700/80 text-gray-700 dark:text-gray-100 border-gray-200 dark:border-gray-500 hover:border-indigo-400 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40'}"
						>
							{person.emoji || '👤'} {person.name}
						</button>
					{/each}
				</div>
			</div>

			<!-- Metric -->
			<div>
				<p class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">What?</p>
				<div class="flex flex-wrap gap-2" role="group" aria-label="Metric selection">
					{#each data.metrics || [] as metric}
						<button
							type="button"
							onclick={() => metricId = metric.id}
							class="px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 border-2 {metricId === metric.id 
								? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-400 shadow-lg shadow-indigo-500/40' 
								: 'bg-white dark:bg-gray-700/80 text-gray-700 dark:text-gray-100 border-gray-200 dark:border-gray-500 hover:border-indigo-400 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40'}"
						>
							{getMetricEmoji(metric.name)} {metric.name}
						</button>
					{/each}
				</div>
			</div>

			<!-- Activity Type (only for Sporting) -->
			{#if isSportingMetric()}
				<div>
					<p class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Activity Type <span class="text-gray-400 dark:text-gray-500">(select one or more)</span>
					</p>
					<div class="flex flex-wrap gap-2" role="group" aria-label="Activity type selection">
						{#each SPORT_ACTIVITIES as activity}
							<button
								type="button"
								onclick={() => toggleTag(activity.value)}
								class="px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 border-2 {selectedTags.includes(activity.value) 
									? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-400 shadow-lg shadow-indigo-500/40' 
									: 'bg-white dark:bg-gray-700/80 text-gray-700 dark:text-gray-100 border-gray-200 dark:border-gray-500 hover:border-indigo-400 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40'}"
							>
								{activity.label}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Date -->
			<div>
				<label for="date" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">When?</label>
				<input
					type="date"
					id="date"
					bind:value={entryDate}
					min={seasonMinDate()}
					max={seasonMaxDate()}
					class="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none text-lg"
				/>
				{#if data.season?.year}
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Entries limited to {data.season.year} season</p>
				{/if}
				<div class="mt-2 flex gap-2">
					{#if isDateInSeason(0)}
						<button
							type="button"
							onclick={() => entryDate = getDateDaysAgo(0)}
							class="px-3 py-1 text-xs rounded-lg transition-all {entryDate === getDateDaysAgo(0) ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'}"
						>
							Today
						</button>
					{/if}
					{#if isDateInSeason(1)}
						<button
							type="button"
							onclick={() => entryDate = getDateDaysAgo(1)}
							class="px-3 py-1 text-xs rounded-lg transition-all bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
						>
							Yesterday
						</button>
					{/if}
					{#if isDateInSeason(2)}
						<button
							type="button"
							onclick={() => entryDate = getDateDaysAgo(2)}
							class="px-3 py-1 text-xs rounded-lg transition-all bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
						>
							2 days ago
						</button>
					{/if}
				</div>
			</div>

			<!-- Notes -->
			<div>
				<label for="notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
					Notes <span class="text-gray-400 dark:text-gray-500">(optional)</span>
				</label>
				<textarea
					id="notes"
					bind:value={notes}
					rows="2"
					placeholder="Evidence details, context..."
					class="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-xl focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none resize-none"
				></textarea>
			</div>

			{#if error}
				<div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 rounded-lg p-3 text-red-700 dark:text-red-300 text-sm">
					{error}
				</div>
			{/if}

			{#if duplicateWarning}
				<div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 text-amber-800 dark:text-amber-300 text-sm">
					<p class="font-semibold">⚠️ Possible duplicate!</p>
					<p>{duplicateWarning.personName} already has a {duplicateWarning.metricName} entry for this date{duplicateWarning.tags ? ` (${duplicateWarning.tags})` : ''}.</p>
				</div>
			{/if}

			{#if success}
				<div class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50 rounded-lg p-3 text-green-700 dark:text-green-300 text-sm flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span>✅</span> Entry added successfully!
					</div>
					{#if lastEntry}
						<button
							type="button"
							onclick={async () => {
								if (!lastEntry) return;
								try {
									const res = await fetch(`${base}/api/entries`, {
										method: 'DELETE',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({ id: lastEntry.id })
									});
									if (res.ok) {
										lastEntry = null;
										success = false;
										await invalidateAll();
									}
								} catch {
									// Ignore
								}
							}}
							class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs font-medium underline"
						>
							Undo
						</button>
					{/if}
				</div>
			{/if}

			<button
				type="submit"
				disabled={loading || !personId || !metricId}
				class="w-full py-4 {duplicateWarning ? 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400'} text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg shadow-lg shadow-indigo-500/25 dark:shadow-indigo-500/40"
			>
				{loading ? 'Adding...' : duplicateWarning ? '⚠️ Add anyway' : '➕ Add Entry'}
			</button>
		</form>
	{/if}
</div>
