<script lang="ts">
	import type { PageData } from './$types';
	import { base } from '$app/paths';
	import type { PlayerStats } from '$lib/leveling';
	import { locale, t } from '$lib/stores/locale';
	import type { Translations, Locale } from '$lib/i18n';

	import PersonOverviewTab from '$lib/components/person/PersonOverviewTab.svelte';
	import PersonInsightsTab from '$lib/components/person/PersonInsightsTab.svelte';
	import PersonCalendarTab from '$lib/components/person/PersonCalendarTab.svelte';
	import PersonCompareTab from '$lib/components/person/PersonCompareTab.svelte';
	import PersonAchievementsTab from '$lib/components/person/PersonAchievementsTab.svelte';
	import PersonHistoryEditor from '$lib/components/person/PersonHistoryEditor.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Subscribe to translations and locale
	let translations = $state<Translations | null>(null);
	let currentLocale = $state<Locale>('en');
	$effect(() => {
		const unsubscribe = t.subscribe(value => {
			translations = value;
		});
		return unsubscribe;
	});
	$effect(() => {
		const unsubscribe = locale.subscribe(value => {
			currentLocale = value;
		});
		return unsubscribe;
	});

	// Cast playerStats from data
	const playerStats = $derived((data as { playerStats?: PlayerStats }).playerStats);

	let activeTab = $state<'overview' | 'insights' | 'calendar' | 'compare' | 'achievements'>('overview');

	// Calculate totals per metric (needed for share text and passing to components)
	const metricTotals = $derived.by(() => {
		const totals: Record<string, number> = {};
		for (const entry of data.entries || []) {
			totals[entry.metric_name] = (totals[entry.metric_name] || 0) + 1;
		}
		return totals;
	});

	const totalEntries = $derived(Object.values(metricTotals).reduce((a, b) => a + b, 0));

	// Unlocked achievement keys (needed for tab button label)
	const unlockedKeys = $derived(new Set((data.achievements || []).map(a => a.key)));

	// Derive sportCounts from entries (needed for PersonOverviewTab and PersonInsightsTab)
	const sportCounts = $derived.by(() => {
		const sportingMetric = data.metrics?.find(m => m.name.toLowerCase() === 'sporting');
		if (!sportingMetric) return [];
		const counts = new Map<string, number>();
		for (const entry of data.entries || []) {
			if (entry.metric_id !== sportingMetric.id) continue;
			const tags = entry.tags ? entry.tags.trim() : '';
			if (!tags) continue;
			let tag = tags;
			try {
				const parsed = JSON.parse(tags);
				if (Array.isArray(parsed) && parsed.length > 0) tag = String(parsed[0]).trim().toLowerCase();
				else if (typeof parsed === 'string') tag = parsed.trim().toLowerCase();
			} catch { tag = tags.split(',')[0].trim().toLowerCase(); }
			// Normalize aliases
			if (tag === 'skating') tag = 'ice-skating';
			if (tag === 'inline-skating' || tag === 'skeeleren') tag = 'road-skating';
			if (tag === 'soccer') tag = 'football';
			if (tag) counts.set(tag, (counts.get(tag) || 0) + 1);
		}
		return Array.from(counts.entries())
			.map(([tag, count]) => ({ tag, count }))
			.sort((a, b) => b.count - a.count);
	});

	// Generate WhatsApp share text for this person
	function generatePersonShareText(): string {
		if (!data.person || !data.season) return '';

		const lines: string[] = [];
		lines.push(`📊 *${data.person.emoji} ${data.person.name}'s ${data.season.year} Progress*`);
		lines.push('');
		lines.push(`📈 Total Entries: ${totalEntries}`);
		lines.push('');

		for (const [metric, count] of Object.entries(metricTotals)) {
			const metricData = data.metrics?.find(m => m.name === metric);
			lines.push(`${metricData?.emoji || '📊'} ${metric}: ${count}`);
		}

		if (unlockedKeys.size > 0) {
			lines.push('');
			lines.push(`🏅 Badges: ${unlockedKeys.size}/${data.allAchievements?.length || 0}`);
		}

		return lines.join('\n');
	}

	function shareToWhatsApp() {
		const text = generatePersonShareText();
		const encodedText = encodeURIComponent(text);
		window.open(`https://wa.me/?text=${encodedText}`, '_blank');
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
		<div class="flex items-center gap-4">
			<a href="{base}/stats" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">←</a>
			<div class="text-4xl">{data.person?.emoji}</div>
			<div class="flex-1">
				<h1 class="text-2xl font-bold text-gray-800 dark:text-white">{data.person?.name}</h1>
				{#if data.season}
					<p class="text-gray-500 dark:text-gray-400">{data.season.name} Stats</p>
				{/if}
			</div>
			<!-- WhatsApp Share Button — hidden for admin role -->
			{#if data.role === 'tracker'}
				<button
					onclick={shareToWhatsApp}
					class="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg transition-colors"
					title="Share to WhatsApp"
				>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
						<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
					</svg>
					<span class="hidden sm:inline">Share</span>
				</button>
			{/if}
			<!-- Legacy Badges -->
			{#if data.legacyBadges && data.legacyBadges.length > 0}
				<div class="flex gap-1">
					{#each data.legacyBadges as badge}
						<div class="relative group">
							<div class="text-2xl cursor-help">{badge.badge_emoji}</div>
							<div class="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
								{badge.year}: {badge.rank === 1 ? 'Champion' : badge.rank === 2 ? 'Runner-up' : 'Third Place'}
								<div class="text-gray-400">{badge.metric} {badge.metric_emoji}</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Legacy History Summary -->
		{#if data.legacyBadges && data.legacyBadges.length > 0}
			<div class="mt-4 pt-4 border-t border-gray-100">
				<div class="flex items-center gap-2 text-sm text-gray-500">
					<span>🏛️ Legacy:</span>
					{#each data.legacyBadges as badge}
						<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r {badge.rank === 1 ? 'from-yellow-100 to-amber-100' : badge.rank === 2 ? 'from-gray-100 to-slate-100' : 'from-orange-50 to-amber-50'} rounded-full text-xs">
							{badge.badge_emoji} {badge.year} {badge.metric}
						</span>
					{/each}
					<a href="{base}/history" class="text-indigo-600 hover:text-indigo-700 ml-auto text-xs">
						View History →
					</a>
				</div>
			</div>
		{/if}
	</div>

	{#if data.error}
		<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
			{data.error}
		</div>
	{:else if !data.season}
		<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800">
			No active season.
		</div>
	{:else}
		<!-- Tabs -->
		<div class="flex gap-2 overflow-x-auto pb-2">
			<button
				onclick={() => activeTab = 'overview'}
				class="px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap {activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}"
			>
				📊 {translations?.stats.overview ?? 'Overview'}
			</button>
			<button
				onclick={() => activeTab = 'insights'}
				class="px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap {activeTab === 'insights' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}"
			>
				✨ Insights
			</button>
			<button
				onclick={() => activeTab = 'calendar'}
				class="px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap {activeTab === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}"
			>
				📅 {translations?.stats.calendar ?? 'Calendar'}
			</button>
			<button
				onclick={() => activeTab = 'achievements'}
				class="px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap {activeTab === 'achievements' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}"
			>
				🏅 {translations?.achievements.title ?? 'Badges'} ({unlockedKeys.size}/{data.allAchievements?.length || 0})
			</button>
			<button
				onclick={() => activeTab = 'compare'}
				class="px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap {activeTab === 'compare' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}"
			>
				⚔️ {translations?.stats.compare ?? 'Compare'}
			</button>
		</div>

		{#if activeTab === 'overview'}
			<PersonOverviewTab
				{playerStats}
				metrics={data.metrics || []}
				goals={data.goals || []}
				streaks={data.streaks || {}}
				entries={data.entries || []}
				consistency={data.consistency || null}
				prediction={data.prediction || null}
				yearOverYear={data.yearOverYear || null}
				streakWarnings={data.streakWarnings || []}
				{sportCounts}
				{metricTotals}
				{totalEntries}
				role={data.role ?? 'tracker'}
				onSwitchToInsights={() => activeTab = 'insights'}
			/>
			<PersonHistoryEditor
				entries={data.entries || []}
				metrics={data.metrics || []}
				person={data.person!}
				season={data.season!}
				role={data.role ?? 'tracker'}
			/>
		{:else if activeTab === 'insights'}
			<PersonInsightsTab
				cumulativeStats={data.cumulativeStats || []}
				seasonYear={data.season?.year ?? new Date().getFullYear()}
				personName={data.person?.name ?? ''}
				personEmoji={data.person?.emoji ?? '👤'}
				{sportCounts}
				dayOfWeekStats={data.dayOfWeekStats || []}
				personalBests={data.personalBests || []}
				metrics={data.metrics || []}
			/>
		{:else if activeTab === 'calendar'}
			<PersonCalendarTab
				calendarData={data.calendarData || {}}
				metrics={data.metrics || []}
				season={data.season!}
			/>
		{:else if activeTab === 'compare'}
			<PersonCompareTab
				comparisons={data.comparisons || []}
				metrics={data.metrics || []}
				person={data.person!}
				{totalEntries}
				{metricTotals}
			/>
		{:else if activeTab === 'achievements'}
			<PersonAchievementsTab
				achievements={data.achievements || []}
				allAchievements={data.allAchievements || []}
			/>
		{/if}

		<!-- Quick nav to other people -->
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
			<h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">View other people:</h3>
			<div class="flex flex-wrap gap-2">
				{#each data.people || [] as person}
					{#if person.id !== data.person?.id}
						<a
							href="{base}/person/{person.id}"
							class="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
						>
							{person.emoji} {person.name}
						</a>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>
