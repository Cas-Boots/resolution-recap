<script lang="ts">
	import type { PageData } from './$types';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import type { PlayerStats } from '$lib/leveling';
	import { locale, t } from '$lib/stores/locale';
	import type { Translations, Locale } from '$lib/i18n';
	import { translateMetric } from '$lib/i18n';

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

	// Helper to translate metric names - accepts metric object or just name string
	function getTranslatedMetricName(metric: string | { name: string; name_nl?: string | null }): string {
		if (typeof metric === 'string') {
			return translateMetric(metric, currentLocale);
		}
		return translateMetric(metric.name, currentLocale, metric.name_nl);
	}
	
	// Cast playerStats from data (types will be regenerated on next build)
	const playerStats = $derived((data as { playerStats?: PlayerStats }).playerStats);
	
	let activeTab = $state<'overview' | 'calendar' | 'compare' | 'achievements'>('overview');
	let selectedMetric = $state<string>('all');
	let compareWith = $state<number | null>(null);

	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	// Calculate totals per metric (needed for share text generation)
	const metricTotals = $derived.by(() => {
		const totals: Record<string, number> = {};
		for (const entry of data.entries || []) {
			totals[entry.metric_name] = (totals[entry.metric_name] || 0) + 1;
		}
		return totals;
	});

	const totalEntries = $derived(Object.values(metricTotals).reduce((a, b) => a + b, 0));

	// Unlocked achievement keys
	const unlockedKeys = $derived(new Set((data.achievements || []).map(a => a.key)));

	// Generate WhatsApp share text for this person
	function generatePersonShareText(): string {
		if (!data.person || !data.season) return '';
		
		const lines: string[] = [];
		lines.push(`📊 *${data.person.emoji} ${data.person.name}'s ${data.season.year} Progress*`);
		lines.push('');
		lines.push(`📈 Total Entries: ${totalEntries}`);
		lines.push('');
		
		// Add per-metric stats
		for (const [metric, count] of Object.entries(metricTotals)) {
			const metricData = data.metrics?.find(m => m.name === metric);
			lines.push(`${metricData?.emoji || '📊'} ${metric}: ${count}`);
		}
		
		// Add achievements
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

	// Generate calendar grid for the year
	const calendarGrid = $derived.by(() => {
		if (!data.season) return [];
		
		const year = data.season.year;
		const weeks: { date: string; count: number; dayOfWeek: number; month: number }[][] = [];
		
		const startDate = new Date(year, 0, 1);
		const endDate = new Date(year, 11, 31);
		
		// Adjust start to beginning of week
		const firstDay = startDate.getDay();
		const adjustedStart = new Date(startDate);
		adjustedStart.setDate(adjustedStart.getDate() - firstDay);
		
		let currentWeek: { date: string; count: number; dayOfWeek: number; month: number }[] = [];
		let current = new Date(adjustedStart);
		
		while (current <= endDate || currentWeek.length > 0) {
			const dateStr = current.toISOString().split('T')[0];
			const isInYear = current.getFullYear() === year;
			
			let count = 0;
			if (isInYear && data.calendarData && data.calendarData[dateStr]) {
				if (selectedMetric === 'all') {
					count = data.calendarData[dateStr].total;
				} else {
					count = data.calendarData[dateStr].byMetric[selectedMetric] || 0;
				}
			}
			
			currentWeek.push({
				date: dateStr,
				count: isInYear ? count : -1, // -1 for dates outside the year
				dayOfWeek: current.getDay(),
				month: current.getMonth()
			});
			
			if (currentWeek.length === 7) {
				weeks.push(currentWeek);
				currentWeek = [];
			}
			
			current.setDate(current.getDate() + 1);
			
			// Stop after end of year's week is complete
			if (current > endDate && currentWeek.length === 0) break;
		}
		
		return weeks;
	});

	// Find max count for color scaling
	const maxCount = $derived.by(() => {
		let max = 1;
		for (const week of calendarGrid) {
			for (const day of week) {
				if (day.count > max) max = day.count;
			}
		}
		return max;
	});

	function getHeatColor(count: number): string {
		if (count < 0) return 'bg-transparent';
		if (count === 0) return 'bg-gray-100';
		const intensity = Math.min(count / maxCount, 1);
		if (intensity <= 0.25) return 'bg-green-200';
		if (intensity <= 0.5) return 'bg-green-400';
		if (intensity <= 0.75) return 'bg-green-500';
		return 'bg-green-600';
	}

	// Comparison data
	const comparisonData = $derived.by(() => {
		if (!compareWith || !data.comparisons) return null;
		return data.comparisons.find(c => c.personId === compareWith);
	});
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
			<!-- WhatsApp Share Button -->
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
					{#each data.legacyBadges as badge, i}
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
				class="px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap {activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
			>
				📊 {translations?.stats.overview ?? 'Overview'}
			</button>
			<button
				onclick={() => activeTab = 'calendar'}
				class="px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap {activeTab === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
			>
				📅 {translations?.stats.calendar ?? 'Calendar'}
			</button>
			<button
				onclick={() => activeTab = 'achievements'}
				class="px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap {activeTab === 'achievements' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
			>
				🏅 {translations?.achievements.title ?? 'Badges'} ({unlockedKeys.size}/{data.allAchievements?.length || 0})
			</button>
			<button
				onclick={() => activeTab = 'compare'}
				class="px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap {activeTab === 'compare' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
			>
				⚔️ {translations?.stats.compare ?? 'Compare'}
			</button>
		</div>

		{#if activeTab === 'overview'}
			<!-- Level & XP Card -->
			{#if playerStats}
				<div class="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg p-4 text-white">
					<div class="flex items-center gap-4">
						<div class="text-4xl">{playerStats.level.emoji}</div>
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<span class="text-lg font-bold">Level {playerStats.level.level}</span>
								<span class="text-purple-200">•</span>
								<span class="text-purple-200">{playerStats.level.name}</span>
							</div>
							<div class="mt-2">
								<div class="flex justify-between text-sm mb-1">
									<span>{playerStats.xp.total.toLocaleString()} XP</span>
									{#if playerStats.xpToNextLevel > 0}
										<span class="text-purple-200">{playerStats.xpToNextLevel.toLocaleString()} to next level</span>
									{:else}
										<span class="text-yellow-300">Max Level!</span>
									{/if}
								</div>
								<div class="w-full bg-purple-900/50 rounded-full h-2.5">
									<div 
										class="bg-gradient-to-r from-yellow-400 to-yellow-300 h-2.5 rounded-full transition-all duration-500"
										style="width: {playerStats.progress}%"
									></div>
								</div>
							</div>
						</div>
					</div>
					<!-- XP Breakdown toggle -->
					<details class="mt-3">
						<summary class="text-sm text-purple-200 cursor-pointer hover:text-white">View XP breakdown</summary>
						<div class="grid grid-cols-3 gap-2 mt-2 text-sm">
							<div class="bg-purple-900/30 rounded p-2 text-center">
								<div class="font-bold">{playerStats.xp.entries}</div>
								<div class="text-purple-200 text-xs">Entries</div>
							</div>
							<div class="bg-purple-900/30 rounded p-2 text-center">
								<div class="font-bold">{playerStats.xp.streaks}</div>
								<div class="text-purple-200 text-xs">Streaks</div>
							</div>
							<div class="bg-purple-900/30 rounded p-2 text-center">
								<div class="font-bold">{playerStats.xp.achievements}</div>
								<div class="text-purple-200 text-xs">Badges</div>
							</div>
							<div class="bg-purple-900/30 rounded p-2 text-center">
								<div class="font-bold">{playerStats.xp.goals}</div>
								<div class="text-purple-200 text-xs">Goals</div>
							</div>
							<div class="bg-purple-900/30 rounded p-2 text-center">
								<div class="font-bold">{playerStats.xp.variety}</div>
								<div class="text-purple-200 text-xs">Variety</div>
							</div>
							<div class="bg-purple-900/30 rounded p-2 text-center">
								<div class="font-bold">{playerStats.xp.consistency}</div>
								<div class="text-purple-200 text-xs">Consistency</div>
							</div>
						</div>
					</details>
				</div>
			{/if}

			<!-- Summary -->
			<div class="grid grid-cols-2 gap-4">
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
					<div class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{totalEntries}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Total Entries</div>
				</div>
				{#each data.metrics || [] as metric}
					<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
						<div class="text-xl mb-1">{metric.emoji}</div>
						<div class="text-2xl font-bold text-gray-800 dark:text-white">{metricTotals[metric.name] || 0}</div>
						<div class="text-sm text-gray-500 dark:text-gray-400">{getTranslatedMetricName(metric)}</div>
					</div>
				{/each}
			</div>

			<!-- Goals -->
			{#if (data.goals || []).length > 0}
				<div class="bg-white rounded-xl shadow-lg p-4">
					<h2 class="font-semibold text-gray-800 mb-3">🎯 Goals Progress</h2>
					<div class="space-y-3">
						{#each data.goals || [] as goal}
							{@const metric = data.metrics?.find(m => m.id === goal.metric_id)}
							{@const current = metricTotals[metric?.name || ''] || 0}
							{@const percent = Math.min(100, Math.round((current / goal.target) * 100))}
							<div>
								<div class="flex justify-between text-sm mb-1">
									<span>{metric?.emoji} {metric ? getTranslatedMetricName(metric) : ''}</span>
									<span class="text-gray-600">{current} / {goal.target} ({percent}%)</span>
								</div>
								<div class="h-3 bg-gray-200 rounded-full overflow-hidden">
									<div 
										class="h-full transition-all {percent >= 100 ? 'bg-green-500' : 'bg-indigo-500'}"
										style="width: {percent}%"
									></div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Streaks -->
			<div class="bg-white rounded-xl shadow-lg p-4">
				<h2 class="font-semibold text-gray-800 mb-3">🔥 Streaks & Records</h2>
				<div class="space-y-3">
					{#each data.metrics || [] as metric}
						{@const streak = data.streaks?.[metric.id]}
						{#if streak && streak.total_entries > 0}
							<div class="p-3 bg-orange-50 rounded-lg">
								<div class="flex items-center justify-between mb-2">
									<span class="font-medium">{metric.emoji} {getTranslatedMetricName(metric)}</span>
									<span class="text-sm text-gray-600">{streak.total_entries} entries</span>
								</div>
								<div class="flex flex-wrap gap-2 text-xs">
									{#if streak.longest_daily_streak > 1}
										<span class="bg-orange-100 text-orange-700 px-2 py-1 rounded">
											🔥 {streak.longest_daily_streak}d streak
										</span>
									{/if}
									{#if streak.longest_weekly_streak > 1}
										<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded">
											📅 {streak.longest_weekly_streak}w streak
										</span>
									{/if}
									{#if streak.busiest_day}
										<span class="bg-purple-100 text-purple-700 px-2 py-1 rounded">
											📌 {streak.busiest_day}s
										</span>
									{/if}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</div>

		{:else if activeTab === 'calendar'}
			<!-- Calendar Heatmap -->
			<div class="bg-white rounded-xl shadow-lg p-4">
				<div class="flex items-center justify-between mb-4">
					<h2 class="font-semibold text-gray-800">📅 Activity Calendar</h2>
					<select
						bind:value={selectedMetric}
						class="px-3 py-1 border rounded-lg text-sm"
					>
						<option value="all">All Metrics</option>
						{#each data.metrics || [] as metric}
							<option value={metric.name}>{metric.emoji} {getTranslatedMetricName(metric)}</option>
						{/each}
					</select>
				</div>

				{#if calendarGrid.length === 0}
					<div class="text-center text-gray-500 py-8">
						No calendar data available
					</div>
				{:else}
					<div class="overflow-x-auto">
						<div class="min-w-[700px]">
							<!-- Month labels -->
							<div class="flex mb-1">
								<div class="w-8"></div>
								{#each monthNames as month, i}
									{@const weekIndex = calendarGrid.findIndex(week => week.some(d => d.month === i && d.count >= 0))}
									{#if weekIndex >= 0}
										<div 
											class="text-xs text-gray-500"
											style="position: absolute; left: {32 + weekIndex * 14}px"
										>
											{month}
										</div>
									{/if}
								{/each}
							</div>
							
							<!-- Day labels + Grid -->
							<div class="flex mt-4">
								<div class="flex flex-col gap-0.5 mr-1 text-xs text-gray-400">
									{#each dayNames as day, i}
										{#if i % 2 === 1}
											<div class="h-3 flex items-center">{day}</div>
										{:else}
											<div class="h-3"></div>
										{/if}
									{/each}
								</div>
								<div class="flex gap-0.5">
									{#each calendarGrid as week}
										<div class="flex flex-col gap-0.5">
											{#each week as day}
												<div 
													class="w-3 h-3 rounded-sm {getHeatColor(day.count)}"
													title="{day.date}: {day.count >= 0 ? day.count : 'N/A'} entries"
												></div>
											{/each}
										</div>
									{/each}
								</div>
							</div>

							<!-- Legend -->
							<div class="flex items-center gap-2 mt-4 text-xs text-gray-500">
								<span>Less</span>
								<div class="w-3 h-3 bg-gray-100 rounded-sm"></div>
								<div class="w-3 h-3 bg-green-200 rounded-sm"></div>
								<div class="w-3 h-3 bg-green-400 rounded-sm"></div>
								<div class="w-3 h-3 bg-green-500 rounded-sm"></div>
								<div class="w-3 h-3 bg-green-600 rounded-sm"></div>
								<span>More</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

		{:else if activeTab === 'compare'}
			<!-- Head-to-Head Comparison -->
			<div class="bg-white rounded-xl shadow-lg p-4">
				<h2 class="font-semibold text-gray-800 mb-4">⚔️ Head-to-Head Comparison</h2>
				
				<div class="mb-4">
					<p class="text-sm text-gray-600 mb-2">Compare with:</p>
					<div class="flex flex-wrap gap-2">
						{#each data.comparisons || [] as other}
							<button
								onclick={() => compareWith = other.personId}
								class="px-4 py-2 rounded-lg transition-colors {compareWith === other.personId ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
							>
								{other.personEmoji} {other.personName}
							</button>
						{/each}
					</div>
				</div>

				{#if compareWith && comparisonData}
					<div class="space-y-4">
						<!-- Total comparison -->
						<div class="p-4 bg-gray-50 rounded-lg">
							<div class="text-center text-sm text-gray-600 mb-2">Total Entries</div>
							<div class="flex items-center justify-between">
								<div class="text-center flex-1">
									<div class="text-3xl mb-1">{data.person?.emoji}</div>
									<div class="text-2xl font-bold text-indigo-600">{totalEntries}</div>
								</div>
								<div class="text-2xl font-bold text-gray-400">vs</div>
								<div class="text-center flex-1">
									<div class="text-3xl mb-1">{comparisonData.personEmoji}</div>
									<div class="text-2xl font-bold text-indigo-600">{comparisonData.total}</div>
								</div>
							</div>
							{#if true}
								{@const diff = totalEntries - comparisonData.total}
								<div class="text-center mt-2 text-sm {diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-500'}">
									{#if diff > 0}
										{data.person?.name} is ahead by {diff}
									{:else if diff < 0}
										{comparisonData.personName} is ahead by {Math.abs(diff)}
									{:else}
										It's a tie!
									{/if}
								</div>
							{/if}
						</div>

						<!-- Per-metric comparison -->
						{#each data.metrics || [] as metric}
							{@const myCount = metricTotals[metric.name] || 0}
							{@const theirCount = comparisonData.metrics[metric.name] || 0}
							{@const maxOfTwo = Math.max(myCount, theirCount, 1)}
							<div class="p-4 bg-gray-50 rounded-lg">
								<div class="flex items-center gap-2 mb-3">
									<span class="text-xl">{metric.emoji}</span>
									<span class="font-medium">{getTranslatedMetricName(metric)}</span>
								</div>
								<div class="space-y-2">
									<div class="flex items-center gap-2">
										<span class="w-20 text-sm">{data.person?.name}</span>
										<div class="flex-1 h-6 bg-gray-200 rounded overflow-hidden">
											<div 
												class="h-full bg-indigo-500"
												style="width: {(myCount / maxOfTwo) * 100}%"
											></div>
										</div>
										<span class="w-8 text-right font-medium">{myCount}</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="w-20 text-sm">{comparisonData.personName}</span>
										<div class="flex-1 h-6 bg-gray-200 rounded overflow-hidden">
											<div 
												class="h-full bg-pink-500"
												style="width: {(theirCount / maxOfTwo) * 100}%"
											></div>
										</div>
										<span class="w-8 text-right font-medium">{theirCount}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-center text-gray-500 py-8">
						Select someone to compare with
					</div>
				{/if}
			</div>

		{:else if activeTab === 'achievements'}
			<!-- Achievements/Badges -->
			<div class="bg-white rounded-xl shadow-lg p-4">
				<div class="flex items-center justify-between mb-4">
					<h2 class="font-semibold text-gray-800">🏅 Achievements</h2>
					<span class="text-sm text-gray-500">{unlockedKeys.size} / {data.allAchievements?.length || 0} unlocked</span>
				</div>
				
				<!-- Progress bar -->
				<div class="h-3 bg-gray-200 rounded-full overflow-hidden mb-6">
					<div 
						class="h-full bg-gradient-to-r from-yellow-400 to-yellow-600"
						style="width: {((unlockedKeys.size / (data.allAchievements?.length || 1)) * 100)}%"
					></div>
				</div>

				<!-- Achievement grid -->
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
					{#each data.allAchievements || [] as achievement}
						{@const isUnlocked = unlockedKeys.has(achievement.key)}
						{@const unlockData = data.achievements?.find(a => a.key === achievement.key)}
						<div 
							class="p-3 rounded-xl border-2 transition-all {isUnlocked 
								? achievement.rarity === 'legendary' ? 'bg-gradient-to-br from-yellow-50 to-amber-100 border-yellow-400' 
								: achievement.rarity === 'epic' ? 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-400' 
								: achievement.rarity === 'rare' ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-400' 
								: 'bg-gradient-to-br from-green-50 to-green-100 border-green-400'
								: 'bg-gray-50 border-gray-200 opacity-50'}"
						>
							<div class="text-3xl text-center mb-2 {isUnlocked ? '' : 'grayscale'}">
								{achievement.emoji}
							</div>
							<div class="text-center">
								<div class="font-medium text-sm {isUnlocked ? 'text-gray-800' : 'text-gray-400'}">
									{achievement.name}
								</div>
								<div class="text-xs {isUnlocked ? 'text-gray-600' : 'text-gray-400'} mt-1">
									{achievement.description}
								</div>
								{#if isUnlocked && unlockData}
									<div class="text-xs text-green-600 mt-2">
										✓ {unlockData.unlocked_at.split('T')[0]}
									</div>
								{/if}
								<div class="mt-2">
									<span class="text-xs px-2 py-0.5 rounded-full {
										achievement.rarity === 'legendary' ? 'bg-yellow-200 text-yellow-800' :
										achievement.rarity === 'epic' ? 'bg-purple-200 text-purple-800' :
										achievement.rarity === 'rare' ? 'bg-blue-200 text-blue-800' :
										'bg-gray-200 text-gray-600'
									}">
										{achievement.rarity}
									</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Quick nav to other people -->
		<div class="bg-white rounded-xl shadow p-4">
			<h3 class="text-sm font-medium text-gray-600 mb-2">View other people:</h3>
			<div class="flex flex-wrap gap-2">
				{#each data.people || [] as person}
					{#if person.id !== data.person?.id}
						<a
							href="{base}/person/{person.id}"
							class="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
						>
							{person.emoji} {person.name}
						</a>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>
