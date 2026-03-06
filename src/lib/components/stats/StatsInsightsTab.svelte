<script lang="ts">
	interface DayOfWeekStats {
		day: string;
		count: number;
		percentage: number;
	}

	interface ConsistencyScore {
		person_emoji?: string;
		person_name: string;
		consistency_percentage: number;
		active_weeks: number;
		total_weeks: number;
		weeks_with_4plus: number;
		longest_gap_days: number;
	}

	interface PersonalBest {
		type: string;
		value: number;
	}

	interface StatGridPerson {
		personId: number;
		personName: string;
		personEmoji: string;
	}

	interface Props {
		dayOfWeekStats: DayOfWeekStats[];
		consistencyScores: ConsistencyScore[];
		personalBests: Record<number, PersonalBest[]>;
		statsGrid: StatGridPerson[];
	}

	let { dayOfWeekStats, consistencyScores, personalBests, statsGrid }: Props = $props();
</script>

<div class="space-y-6">
	<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors duration-200">
		<h3 class="font-semibold text-gray-800 dark:text-white mb-4">📊 Day of Week Insights</h3>
		<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">When do entries happen most frequently?</p>

		{#if dayOfWeekStats && dayOfWeekStats.length > 0}
			{@const maxDayCount = Math.max(...dayOfWeekStats.map((d) => d.count), 1)}
			{@const busiestDay = dayOfWeekStats.reduce((a, b) => (a.count > b.count ? a : b))}

			<div class="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
				<span class="text-indigo-800 dark:text-indigo-200">
					🏆 <strong>{busiestDay.day}</strong> is the most active day with <strong>{busiestDay.count}</strong> entries ({busiestDay.percentage}%)
				</span>
			</div>

			<div class="space-y-2">
				{#each dayOfWeekStats as day}
					<div class="flex items-center gap-3">
						<div class="w-12 text-sm text-gray-600 dark:text-gray-400">{day.day.substring(0, 3)}</div>
						<div class="flex-1 h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
							<div
								class="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all duration-700"
								style="width: {(day.count / maxDayCount) * 100}%"
							></div>
						</div>
						<div class="w-16 text-right text-sm text-gray-600 dark:text-gray-400">
							{day.count} <span class="text-xs">({day.percentage}%)</span>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center text-gray-500 dark:text-gray-400 py-8">No data available yet</div>
		{/if}
	</div>

	<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors duration-200">
		<h3 class="font-semibold text-gray-800 dark:text-white mb-4">🎯 Consistency Scores</h3>
		<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">How regularly are entries being logged?</p>

		{#if consistencyScores && consistencyScores.length > 0}
			<div class="space-y-4">
				{#each consistencyScores as score}
					<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<span class="text-xl">{score.person_emoji}</span>
								<span class="font-medium text-gray-800 dark:text-white">{score.person_name}</span>
							</div>
							<div class="text-2xl font-bold {score.consistency_percentage >= 75 ? 'text-green-600 dark:text-green-400' : score.consistency_percentage >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-orange-600 dark:text-orange-400'}">
								{score.consistency_percentage}%
							</div>
						</div>
						<div class="relative h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-3">
							<div
								class="absolute h-full rounded-full transition-all duration-700 {score.consistency_percentage >= 75 ? 'bg-green-500' : score.consistency_percentage >= 50 ? 'bg-yellow-500' : 'bg-orange-500'}"
								style="width: {score.consistency_percentage}%"
							></div>
						</div>
						<div class="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
							<span>📅 {score.active_weeks}/{score.total_weeks} weeks active</span>
							<span>⭐ {score.weeks_with_4plus} weeks with 4+ entries</span>
							{#if score.longest_gap_days > 0}
								<span>😴 Longest break: {score.longest_gap_days} days</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center text-gray-500 dark:text-gray-400 py-8">No data available yet</div>
		{/if}
	</div>

	<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors duration-200">
		<h3 class="font-semibold text-gray-800 dark:text-white mb-4">🏅 Personal Bests</h3>
		<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Individual achievements and records</p>

		{#if personalBests && Object.keys(personalBests).length > 0}
			<div class="space-y-4">
				{#each statsGrid as person}
					{@const bests = personalBests[person.personId] || []}
					{#if bests.length > 0}
						<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
							<div class="flex items-center gap-2 mb-3">
								<span class="text-xl">{person.personEmoji}</span>
								<span class="font-medium text-gray-800 dark:text-white">{person.personName}</span>
							</div>
							<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
								{#each bests as best}
									<div class="bg-white dark:bg-gray-800 rounded p-2 text-center">
										<div class="text-lg font-bold text-indigo-600 dark:text-indigo-400">{best.value}</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">
											{#if best.type === 'best_day'}
												📅 Best Day
											{:else if best.type === 'best_week'}
												📆 Best Week
											{:else if best.type === 'best_month'}
												🗓️ Best Month
											{:else if best.type === 'longest_gap'}
												😴 Longest Break
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			<div class="text-center text-gray-500 dark:text-gray-400 py-8">No personal bests recorded yet</div>
		{/if}
	</div>
</div>
