<script lang="ts">
	import type { PageData } from './$types';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	
	let activeTab = $state<'overview' | 'calendar' | 'compare' | 'achievements'>('overview');
	let selectedMetric = $state<string>('all');
	let compareWith = $state<number | null>(null);

	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	// Unlocked achievement keys
	const unlockedKeys = $derived(new Set((data.achievements || []).map(a => a.key)));

	// Calculate totals per metric
	const metricTotals = $derived.by(() => {
		const totals: Record<string, number> = {};
		for (const entry of data.entries || []) {
			totals[entry.metric_name] = (totals[entry.metric_name] || 0) + 1;
		}
		return totals;
	});

	const totalEntries = $derived(Object.values(metricTotals).reduce((a, b) => a + b, 0));

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
	<div class="bg-white rounded-2xl shadow-lg p-6">
		<div class="flex items-center gap-4">
			<a href="{base}/stats" class="text-gray-400 hover:text-gray-600">←</a>
			<div class="text-4xl">{data.person?.emoji}</div>
			<div>
				<h1 class="text-2xl font-bold text-gray-800">{data.person?.name}</h1>
				{#if data.season}
					<p class="text-gray-500">{data.season.name} Stats</p>
				{/if}
			</div>
		</div>
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
				📊 Overview
			</button>
			<button
				onclick={() => activeTab = 'calendar'}
				class="px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap {activeTab === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
			>
				📅 Calendar
			</button>
			<button
				onclick={() => activeTab = 'achievements'}
				class="px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap {activeTab === 'achievements' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
			>
				🏅 Badges ({unlockedKeys.size}/{data.allAchievements?.length || 0})
			</button>
			<button
				onclick={() => activeTab = 'compare'}
				class="px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap {activeTab === 'compare' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
			>
				⚔️ Compare
			</button>
		</div>

		{#if activeTab === 'overview'}
			<!-- Summary -->
			<div class="grid grid-cols-2 gap-4">
				<div class="bg-white rounded-xl shadow p-4 text-center">
					<div class="text-3xl font-bold text-indigo-600">{totalEntries}</div>
					<div class="text-sm text-gray-500">Total Entries</div>
				</div>
				{#each data.metrics || [] as metric}
					<div class="bg-white rounded-xl shadow p-4 text-center">
						<div class="text-xl mb-1">{metric.emoji}</div>
						<div class="text-2xl font-bold text-gray-800">{metricTotals[metric.name] || 0}</div>
						<div class="text-sm text-gray-500">{metric.name}</div>
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
									<span>{metric?.emoji} {metric?.name}</span>
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
									<span class="font-medium">{metric.emoji} {metric.name}</span>
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
							<option value={metric.name}>{metric.emoji} {metric.name}</option>
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
									<span class="font-medium">{metric.name}</span>
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
