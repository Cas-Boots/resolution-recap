<script lang="ts">
	import type { PageData } from './$types';
	import { goto, invalidateAll } from '$app/navigation';
	import { base } from '$app/paths';
	import { t } from '$lib/stores/locale';
	import { pushAchievementCelebrations } from '$lib/stores/celebrations';
	import type { Translations } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Subscribe to translations
	let translations = $state<Translations | null>(null);
	$effect(() => {
		const unsubscribe = t.subscribe(value => {
			translations = value;
		});
		return unsubscribe;
	});

	// Predefined sport activity types - reactive for translations
	const SPORT_GROUPS = $derived([
		{
			label: 'Cardio',
			sports: [
				{ value: 'running', label: `🏃 ${translations?.sports.running ?? 'Running'}` },
				{ value: 'cycling', label: `🚴 ${translations?.sports.cycling ?? 'Cycling'}` },
				{ value: 'hiking', label: `🥾 ${translations?.sports.hiking ?? 'Hiking'}` },
			]
		},
		{
			label: 'Water',
			sports: [
				{ value: 'swimming', label: `🏊 ${translations?.sports.swimming ?? 'Swimming'}` },
				{ value: 'kayaking', label: `🛶 ${translations?.sports.kayaking ?? 'Kayaking'}` },
				{ value: 'rafting', label: `🚣 ${translations?.sports.rafting ?? 'Rafting'}` },
				{ value: 'rowing', label: `🚣 ${translations?.sports.rowing ?? 'Rowing'}` },
			]
		},
		{
			label: 'Gym & Fitness',
			sports: [
				{ value: 'gym', label: `🏋️ ${translations?.sports.gym ?? 'Gym'}` },
				{ value: 'hyrox', label: `🏆 ${translations?.sports.hyrox ?? 'Hyrox'}` },
				{ value: 'bootcamp', label: `💪 ${translations?.sports.bootcamp ?? 'Bootcamp'}` },
				{ value: 'physio', label: `🧑‍⚕️ ${translations?.sports.physio ?? 'Physio'}` },
			]
		},
		{
			label: 'Mind & Body',
			sports: [
				{ value: 'yoga', label: `🧘 ${translations?.sports.yoga ?? 'Yoga'}` },
				{ value: 'pilates', label: `🧘 ${translations?.sports.pilates ?? 'Pilates'}` },
			]
		},
		{
			label: 'Racket',
			sports: [
				{ value: 'tennis', label: `🎾 ${translations?.sports.tennis ?? 'Tennis'}` },
				{ value: 'padel', label: `🎾 ${translations?.sports.padel ?? 'Padel'}` },
				{ value: 'badminton', label: `🏸 ${translations?.sports.badminton ?? 'Badminton'}` },
				{ value: 'squash', label: `🎾 ${translations?.sports.squash ?? 'Squash'}` },
				{ value: 'table-tennis', label: `🏓 ${translations?.sports.tableTennis ?? 'Table Tennis'}` },
			]
		},
		{
			label: 'Team',
			sports: [
				{ value: 'football', label: `⚽ ${translations?.sports.football ?? 'Football'}` },
				{ value: 'basketball', label: `🏀 ${translations?.sports.basketball ?? 'Basketball'}` },
				{ value: 'hockey', label: `🏑 ${translations?.sports.hockey ?? 'Hockey'}` },
				{ value: 'volleyball', label: `🏐 ${translations?.sports.volleyball ?? 'Volleyball'}` },
				{ value: 'korfball', label: `🏐 ${translations?.sports.korfball ?? 'Korfball'}` },
			]
		},
		{
			label: 'Climbing',
			sports: [
				{ value: 'climbing', label: `🧗 ${translations?.sports.climbing ?? 'Climbing'}` },
				{ value: 'bouldering', label: `🧗 ${translations?.sports.bouldering ?? 'Bouldering'}` },
			]
		},
		{
			label: 'Winter',
			sports: [
				{ value: 'skiing', label: `⛷️ ${translations?.sports.skiing ?? 'Skiing'}` },
				{ value: 'snowboarding', label: `🏂 ${translations?.sports.snowboarding ?? 'Snowboarding'}` },
				{ value: 'ice-skating', label: `⛸️ ${translations?.sports.iceSkating ?? 'Ice Skating'}` },
				{ value: 'road-skating', label: `🛼 ${translations?.sports.roadSkating ?? 'Road Skating'}` },
				{ value: 'sledding', label: `🛷 ${translations?.sports.sledding ?? 'Sledding'}` },
			]
		},
		{
			label: 'Combat',
			sports: [
				{ value: 'boxing', label: `🥊 ${translations?.sports.boxing ?? 'Boxing'}` },
				{ value: 'martial-arts', label: `🥋 ${translations?.sports.martialArts ?? 'Martial Arts'}` },
			]
		},
		{
			label: 'Other',
			sports: [
				{ value: 'dance', label: `💃 ${translations?.sports.dance ?? 'Dance'}` },
				{ value: 'other', label: `🏅 ${translations?.sports.other ?? 'Other'}` },
			]
		},
	]);

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
	let selectedTag = $state<string | null>(null);
	let loading = $state(false);
	let error = $state('');
	let success = $state(false);
	let duplicateWarning = $state<{ personName: string; metricName: string; tags?: string } | null>(null);
	let skipDuplicateCheck = $state(false);
	let lastEntry = $state<{ id: number; personName: string; metricName: string; date: string } | null>(null);

	// Season date bounds
	let seasonMinDate = $derived(() => {
		if (!data.season?.year) return undefined;
		return `${data.season.year}-01-01`;
	});
	let seasonMaxDate = $derived(() => {
		if (!data.season?.year) return undefined;
		return `${data.season.year}-12-31`;
	});

	async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		try {
			return await fetch(input, { ...init, signal: controller.signal });
		} finally {
			clearTimeout(timeoutId);
		}
	}

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
			const res = await fetchWithTimeout(`${base}/api/entries/check-duplicate?personId=${personId}&metricId=${metricId}&entryDate=${entryDate}`, { cache: 'no-store' }, 5000);
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

	function selectTag(tag: string) {
		selectedTag = selectedTag === tag ? null : tag;
	}

	$effect(() => {
		if (!isSportingMetric()) {
			selectedTag = null;
		}
	});

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

		if (isSportingMetric() && !selectedTag) {
			error = 'Please select the specific sporting activity.';
			return;
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
					tags: selectedTag || undefined
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
					pushAchievementCelebrations(personId, person?.name || 'Unknown', result.newAchievements);
				}
				
				// Reset form for quick successive entries
				personId = null;
				metricId = null;
				notes = '';
				selectedTag = null;
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

<div class="space-y-6">
	<div class="bg-white dark:bg-gray-800/90 dark:backdrop-blur-sm rounded-2xl shadow-lg dark:shadow-indigo-500/10 p-6 dark:border dark:border-gray-700/50">
		<h1 class="text-2xl font-bold text-gray-800 dark:text-white mb-1">➕ {translations?.nav.add ?? 'Add Entry'}</h1>
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
						Activity Type <span class="text-gray-400 dark:text-gray-500">(select one)</span>
					</p>
					<div class="space-y-3" role="group" aria-label="Activity type selection">
						{#each SPORT_GROUPS as group}
							<div>
								<p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{group.label}</p>
								<div class="flex flex-wrap gap-2">
									{#each group.sports as activity}
										<button
											type="button"
											onclick={() => selectTag(activity.value)}
											class="px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 border-2 {selectedTag === activity.value
												? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-400 shadow-lg shadow-indigo-500/40'
												: 'bg-white dark:bg-gray-700/80 text-gray-700 dark:text-gray-100 border-gray-200 dark:border-gray-500 hover:border-indigo-400 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40'}"
										>
											{activity.label}
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
					<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Each sporting activity must be logged as a separate entry.</p>
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
				disabled={loading || !personId || !metricId || (isSportingMetric() && !selectedTag)}
				class="w-full py-4 {duplicateWarning ? 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400'} text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg shadow-lg shadow-indigo-500/25 dark:shadow-indigo-500/40"
			>
				{loading ? 'Adding...' : duplicateWarning ? '⚠️ Add anyway' : '➕ Add Entry'}
			</button>
		</form>
	{/if}
</div>
