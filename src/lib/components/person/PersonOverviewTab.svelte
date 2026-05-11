<script lang="ts">
	import type { PlayerStats } from '$lib/leveling';
	import type { Metric, GoalWithNames, StreakData, EntryWithNames, ConsistencyData, Prediction, YearOverYearComparison } from '$lib/server/db';
	import { getLocale } from '$lib/stores/locale.svelte';
	import { translateMetric } from '$lib/i18n';

	const locale = $derived(getLocale());
	import PersonInsightCard from './PersonInsightCard.svelte';

	interface Props {
		playerStats: PlayerStats | undefined;
		metrics: Metric[];
		goals: GoalWithNames[];
		streaks: Record<number, StreakData | undefined>;
		entries: EntryWithNames[];
		consistency: ConsistencyData | null;
		prediction: Prediction | null;
		yearOverYear: YearOverYearComparison | null;
		streakWarnings: { person_id: number; metric_name: string; metric_emoji: string; current_streak: number }[];
		sportCounts: { tag: string; count: number }[];
		metricTotals: Record<string, number>;
		totalEntries: number;
		role: 'tracker' | 'admin';
		onSwitchToInsights: () => void;
	}

	let {
		playerStats,
		metrics,
		goals,
		streaks,
		entries,
		consistency,
		prediction,
		yearOverYear,
		streakWarnings,
		sportCounts,
		metricTotals,
		totalEntries,
		role,
		onSwitchToInsights
	}: Props = $props();

	function getTranslatedMetricName(metric: string | { name: string; name_nl?: string | null }): string {
		if (typeof metric === 'string') return translateMetric(metric, locale);
		return translateMetric(metric.name, locale, metric.name_nl);
	}

	// Derive the sporting metric id
	const sportingMetricId = $derived(
		metrics.find((m) => m.name.toLowerCase() === 'sporting')?.id ?? null
	);

	// Insight cards — build list conditionally
	interface InsightCardDef {
		icon: string;
		title: string;
		value: string;
		sub: string;
		severity: 'good' | 'warning' | 'neutral';
	}

	const insightCards = $derived.by((): InsightCardDef[] => {
		const cards: InsightCardDef[] = [];

		if (prediction) {
			cards.push({
				icon: '🎯',
				title: 'Pace',
				value: prediction.projected_final.toString(),
				sub: 'projected total',
				severity: prediction.confidence === 'high' ? 'good' : 'neutral'
			});
		}

		if (yearOverYear && yearOverYear.difference !== null) {
			cards.push({
				icon: yearOverYear.difference >= 0 ? '📈' : '📉',
				title: 'vs 2025',
				value: `${yearOverYear.difference >= 0 ? '+' : ''}${yearOverYear.difference}`,
				sub: 'vs same point last year',
				severity: yearOverYear.difference >= 0 ? 'good' : 'warning'
			});
		}

		if (consistency) {
			cards.push({
				icon: '🎯',
				title: 'Consistency',
				value: `${consistency.consistency_percentage}%`,
				sub: `${consistency.active_weeks} of ${consistency.total_weeks} weeks`,
				severity:
					consistency.consistency_percentage >= 60
						? 'good'
						: consistency.consistency_percentage >= 40
							? 'warning'
							: 'neutral'
			});
		}

		if (streakWarnings.length > 0) {
			cards.push({
				icon: '⚠️',
				title: 'Streak at Risk',
				value: `${streakWarnings[0].current_streak} days`,
				sub: `${streakWarnings[0].metric_emoji} ${streakWarnings[0].metric_name}`,
				severity: 'warning'
			});
		}

		return cards;
	});

	// Top 3 sport counts for preview
	const topSportCounts = $derived([...sportCounts].sort((a, b) => b.count - a.count).slice(0, 3));
</script>

<div class="space-y-4">
	<!-- Section 1: Level / XP Card -->
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

	<!-- Section 2: Insight cards row -->
	{#if insightCards.length > 0}
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
			{#each insightCards as card}
				<PersonInsightCard
					icon={card.icon}
					title={card.title}
					value={card.value}
					sub={card.sub}
					severity={card.severity}
				/>
			{/each}
		</div>
	{/if}

	<!-- Section 3: Summary tiles -->
	<div class="grid grid-cols-2 gap-4">
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
			<div class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{totalEntries}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400">Total Entries</div>
		</div>
		{#each metrics as metric}
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
				<div class="text-xl mb-1">{metric.emoji}</div>
				<div class="text-2xl font-bold text-gray-800 dark:text-white">{metricTotals[metric.name] || 0}</div>
				<div class="text-sm text-gray-500 dark:text-gray-400">{getTranslatedMetricName(metric)}</div>
			</div>
		{/each}
	</div>

	<!-- Section 4: Streaks & records (REVAMPED) -->
	<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 transition-colors duration-200">
		<h2 class="font-semibold text-gray-800 dark:text-white mb-3">🔥 Streaks &amp; Records</h2>
		<div class="space-y-3">
			{#each metrics as metric}
				{@const streak = streaks[metric.id]}
				{#if streak && streak.total_entries > 0}
					<div class="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
						<div class="flex items-center justify-between mb-2">
							<span class="font-medium text-gray-800 dark:text-white">
								{metric.emoji} {getTranslatedMetricName(metric)}
							</span>
							<span class="text-sm text-gray-600 dark:text-gray-400">{streak.total_entries} entries</span>
						</div>
						<div class="space-y-1 text-sm text-gray-700 dark:text-gray-300">
							<div>
								🔥 Daily: <span class="font-semibold">{streak.current_daily_streak}</span> now
								/ <span class="font-semibold">{streak.longest_daily_streak}</span> best
							</div>
							<div>
								📅 Weekly: <span class="font-semibold">{streak.current_weekly_streak}</span> now
								/ <span class="font-semibold">{streak.longest_weekly_streak}</span> best
							</div>
						</div>
						{#if streak.busiest_day || streak.busiest_month}
							<div class="flex flex-wrap gap-2 text-xs mt-2">
								{#if streak.busiest_day}
									<span class="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-1 rounded">
										📌 {streak.busiest_day}s
									</span>
								{/if}
								{#if streak.busiest_month}
									<span class="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
										🗓️ {streak.busiest_month}
									</span>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Section 5: Goals progress -->
	{#if goals.length > 0}
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 transition-colors duration-200">
			<h2 class="font-semibold text-gray-800 dark:text-white mb-3">🎯 Goals Progress</h2>
			<div class="space-y-3">
				{#each goals as goal}
					{@const metric = metrics.find((m) => m.id === goal.metric_id)}
					{@const current = metricTotals[metric?.name || ''] || 0}
					{@const percent = Math.min(100, Math.round((current / goal.target) * 100))}
					<div>
						<div class="flex justify-between text-sm mb-1">
							<span>{metric?.emoji} {metric ? getTranslatedMetricName(metric) : ''}</span>
							<span class="text-gray-600 dark:text-gray-400">{current} / {goal.target} ({percent}%)</span>
						</div>
						<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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

	<!-- Section 6: Sport-mix preview -->
	{#if sportingMetricId !== null && sportCounts.length > 0}
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 transition-colors duration-200">
			<div class="flex items-center justify-between mb-2">
				<h2 class="font-semibold text-gray-800 dark:text-white">🏃 Sport Mix</h2>
				<button
					onclick={onSwitchToInsights}
					class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
				>
					View full breakdown →
				</button>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each topSportCounts as sc}
					<span class="bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 px-3 py-1 rounded-full text-sm font-medium">
						{sc.tag} {sc.count}
					</span>
				{/each}
			</div>
		</div>
	{/if}
</div>
