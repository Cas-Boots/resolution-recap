<script lang="ts">
import type { PageData } from './$types';
import { base } from '$app/paths';
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

// Tab state
let activeTab = $state<'seasons' | 'alltime' | 'compare' | 'predictions' | 'timeline'>('seasons');

// Expanded season state
let expandedYear = $state<number | null>(null);

// Head-to-head comparison state
let comparePersons = $state<[string | null, string | null]>([null, null]);

function toggleSeason(year: number) {
expandedYear = expandedYear === year ? null : year;
}

function formatScore(score: number | null): string {
if (score === null) return 'No data';
return score.toString();
}

function getMedalEmoji(rank: number): string {
switch (rank) {
case 1: return '🥇';
case 2: return '🥈';
case 3: return '🥉';
default: return '';
}
}

function getChangeColor(diff: number | null): string {
if (diff === null) return 'text-gray-400';
if (diff > 0) return 'text-green-600 dark:text-green-400';
if (diff < 0) return 'text-red-600 dark:text-red-400';
return 'text-gray-600 dark:text-gray-400';
}

function getConfidenceColor(confidence: string): string {
switch (confidence) {
case 'high': return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300';
default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}
}

// Head-to-head data computation
const h2hData = $derived.by(() => {
if (!comparePersons[0] || !comparePersons[1]) return null;

const person1 = comparePersons[0];
const person2 = comparePersons[1];

// Build comparison from historical data
const result = {
person1: { name: person1, emoji: '👤', wins: 0 },
person2: { name: person2, emoji: '👤', wins: 0 },
ties: 0,
seasons: [] as { year: number; metric: string; metric_emoji: string; p1_score: number | null; p2_score: number | null; p1_rank: number; p2_rank: number; winner: 1 | 2 | 0 }[]
};

for (const season of data.historicalSeasons || []) {
const p1Result = season.results.find((r: { person_name: string }) => r.person_name === person1 || (person1 === 'Bas' && r.person_name === 'Bastiaan'));
const p2Result = season.results.find((r: { person_name: string }) => r.person_name === person2 || (person2 === 'Bas' && r.person_name === 'Bastiaan'));

if (p1Result) result.person1.emoji = p1Result.person_emoji;
if (p2Result) result.person2.emoji = p2Result.person_emoji;

if (p1Result && p2Result) {
let winner: 1 | 2 | 0 = 0;
if (p1Result.score !== null && p2Result.score !== null) {
if (p1Result.score > p2Result.score) {
winner = 1;
result.person1.wins++;
} else if (p2Result.score > p1Result.score) {
winner = 2;
result.person2.wins++;
} else {
result.ties++;
}
}

result.seasons.push({
year: season.year,
metric: season.metric,
metric_emoji: season.metric_emoji,
p1_score: p1Result.score,
p2_score: p2Result.score,
p1_rank: p1Result.rank,
p2_rank: p2Result.rank,
winner
});
}
}

return result;
});

// Get unique person names for comparison dropdown
const allPersonNames = $derived.by(() => {
const names = new Set<string>();
for (const season of data.historicalSeasons || []) {
for (const result of season.results) {
// Normalize Bastiaan to Bas
names.add(result.person_name === 'Bastiaan' ? 'Bas' : result.person_name);
}
}
return Array.from(names).sort();
});

// Timeline chart max score for scaling
const maxTimelineScore = $derived.by(() => {
let max = 1;
for (const person of data.timelineData?.people || []) {
for (const d of person.data) {
if (d.score !== null && d.score > max) max = d.score;
}
}
return max;
});
</script>

{#if !data.authorized}
<div class="text-center py-12">
<p class="text-gray-500 dark:text-gray-400">Please log in to view history.</p>
</div>
{:else}
<div class="space-y-6">
<!-- Header with current season link -->
<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
<div class="flex items-center justify-between flex-wrap gap-4">
<div>
<h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
<span>📜</span> {translations?.nav.history ?? 'History'}
</h1>
<p class="text-gray-500 dark:text-gray-400 mt-1">
Our journey through the years
</p>
</div>
<a 
href="{base}/stats" 
class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-md"
>
<span>📈</span> Current Season
</a>
</div>
</div>

<!-- Tab Navigation -->
<div class="flex gap-2 overflow-x-auto pb-2">
<button
onclick={() => activeTab = 'seasons'}
class="px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap {activeTab === 'seasons' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
>
🏆 Seasons
</button>
<button
onclick={() => activeTab = 'alltime'}
class="px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap {activeTab === 'alltime' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
>
👑 All-Time
</button>
<button
onclick={() => activeTab = 'predictions'}
class="px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap {activeTab === 'predictions' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
>
🔮 Predictions
</button>
<button
onclick={() => activeTab = 'compare'}
class="px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap {activeTab === 'compare' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
>
⚔️ Head-to-Head
</button>
<button
onclick={() => activeTab = 'timeline'}
class="px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap {activeTab === 'timeline' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
>
📈 Timeline
</button>
</div>

<!-- SEASONS TAB -->
{#if activeTab === 'seasons'}
<!-- Info banner -->
<div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
<p class="text-gray-700 dark:text-gray-300 text-sm">
💡 Before we built this fancy app, we tracked our resolutions in a more basic way. 
Here's a look back at our previous challenges!
</p>
</div>

{#if data.historicalSeasons && data.historicalSeasons.length > 0}
<div class="space-y-4">
{#each data.historicalSeasons as season}
<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
<!-- Season Header - Clickable -->
<button
onclick={() => toggleSeason(season.year)}
class="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
>
<div class="flex items-center gap-3">
<span class="text-3xl">{season.metric_emoji}</span>
<div>
<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
{season.name}
</h2>
<p class="text-sm text-gray-500 dark:text-gray-400">
{season.metric}
</p>
</div>
</div>
<div class="flex items-center gap-3">
<div class="text-right hidden sm:block">
<div class="text-sm text-gray-500 dark:text-gray-400">Winner</div>
<div class="font-semibold text-gray-900 dark:text-white">
{season.results[0]?.person_emoji} {season.results[0]?.person_name}
</div>
</div>
<span class="text-2xl transition-transform duration-200 {expandedYear === season.year ? 'rotate-180' : ''}">
⌄
</span>
</div>
</button>

<!-- Expanded Content -->
{#if expandedYear === season.year}
<div class="border-t border-gray-200 dark:border-gray-700 p-4 animate-in">
<p class="text-gray-600 dark:text-gray-400 mb-4 text-sm italic">
{season.description}
</p>

<!-- Leaderboard -->
<div class="space-y-2">
{#each season.results as result, index}
<div 
class="flex items-center justify-between p-3 rounded-lg transition-colors
{index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800' :
 index === 1 ? 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 border border-gray-200 dark:border-gray-600' :
 index === 2 ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800' :
 'bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700'}"
>
<div class="flex items-center gap-3">
<span class="text-xl w-8 text-center">
{getMedalEmoji(result.rank) || '#' + result.rank}
</span>
<span class="text-2xl">{result.person_emoji}</span>
<div>
<span class="font-medium text-gray-900 dark:text-white">
{result.person_name}
</span>
<!-- Legacy badges -->
{#if result.rank === 1}
<div class="text-xs text-amber-600 dark:text-amber-400">
🏆 {season.metric} Champion
</div>
{/if}
</div>
</div>
<div class="text-right">
{#if result.score !== null}
<span class="text-xl font-bold text-gray-900 dark:text-white">
{formatScore(result.score)}
</span>
<span class="text-sm text-gray-500 dark:text-gray-400 ml-1">
{season.metric === 'Sporting' ? (currentLocale === 'nl' ? 'sessies' : 'sessions') : (currentLocale === 'nl' ? 'taarten' : 'cakes')}
</span>
{:else}
<span class="text-gray-400 dark:text-gray-500 italic">
No data
</span>
{/if}
</div>
</div>
{/each}
</div>

<!-- Season Summary -->
<div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
<div class="grid grid-cols-2 gap-4 text-center">
<div>
<div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
{season.results.reduce((sum, r) => sum + (r.score || 0), 0)}
</div>
<div class="text-sm text-gray-500 dark:text-gray-400">
Total {season.metric === 'Sporting' ? (currentLocale === 'nl' ? 'Sessies' : 'Sessions') : (currentLocale === 'nl' ? 'Taarten' : 'Cakes')}
</div>
</div>
<div>
<div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
{season.results.filter(r => r.score !== null).length}
</div>
<div class="text-sm text-gray-500 dark:text-gray-400">
Participants
</div>
</div>
</div>
</div>
</div>
{/if}
</div>
{/each}
</div>
{:else}
<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
<span class="text-4xl">📜</span>
<p class="text-gray-500 dark:text-gray-400 mt-2">No historical data available.</p>
</div>
{/if}
{/if}

<!-- ALL-TIME TAB -->
{#if activeTab === 'alltime'}
<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
<div class="bg-gradient-to-r from-amber-500 to-orange-500 p-4">
<h2 class="text-xl font-bold text-white flex items-center gap-2">
👑 All-Time Leaderboard
</h2>
<p class="text-amber-100 text-sm">Combined achievements across all seasons</p>
</div>

<div class="p-4 space-y-3">
{#each data.allTimeLeaderboard || [] as stats, index}
<div class="flex items-center justify-between p-4 rounded-lg {index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-2 border-yellow-300 dark:border-yellow-700' : 'bg-gray-50 dark:bg-gray-700/50'}">
<div class="flex items-center gap-4">
<div class="text-2xl font-bold text-gray-400 w-8">
{#if index === 0}👑{:else if index === 1}🥈{:else if index === 2}🥉{:else}#{index + 1}{/if}
</div>
<span class="text-3xl">{stats.person_emoji}</span>
<div>
<div class="font-semibold text-gray-900 dark:text-white text-lg">{stats.person_name}</div>
<div class="flex flex-wrap gap-1 mt-1">
{#each Array(stats.championships) as _}
<span class="text-sm" title="Championship">🏆</span>
{/each}
{#each Array(stats.podiums - stats.championships) as _}
<span class="text-sm" title="Podium finish">🏅</span>
{/each}
</div>
</div>
</div>
<div class="text-right">
<div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.championships}</div>
<div class="text-xs text-gray-500 dark:text-gray-400">Championships</div>
<div class="text-sm text-gray-600 dark:text-gray-300 mt-1">
{stats.podiums} podiums · {stats.seasons_participated} seasons
</div>
</div>
</div>
{/each}
</div>
</div>

<!-- Legacy Badges Section -->
<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
<div class="bg-gradient-to-r from-purple-500 to-indigo-500 p-4">
<h2 class="text-xl font-bold text-white flex items-center gap-2">
🎖️ Legacy Badges
</h2>
<p class="text-purple-100 text-sm">Championship titles earned</p>
</div>

<div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
{#each Object.entries(data.legacyBadges || {}) as [personName, badges]}
{#if badges.length > 0}
<div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
<div class="font-medium text-gray-900 dark:text-white mb-2">{personName}</div>
<div class="flex flex-wrap gap-2">
{#each badges as badge}
<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium {badge.rank === 1 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' : badge.rank === 2 ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'}">
{badge.badge_emoji} {badge.year}
</span>
{/each}
</div>
</div>
{/if}
{/each}
</div>
</div>
{/if}

<!-- PREDICTIONS TAB -->
{#if activeTab === 'predictions'}
<!-- Year-over-Year Comparison -->
{#if data.yearOverYear && data.yearOverYear.length > 0}
<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
<div class="bg-gradient-to-r from-green-500 to-emerald-500 p-4">
<h2 class="text-xl font-bold text-white flex items-center gap-2">
📊 Year-over-Year Comparison
</h2>
<p class="text-green-100 text-sm">2026 vs 2025 at Day {data.dayOfYear}</p>
</div>

<div class="p-4 space-y-3">
{#each data.yearOverYear as comparison}
<div class="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
<div class="flex items-center justify-between mb-2">
<div class="flex items-center gap-2">
<span class="text-2xl">{comparison.person_emoji}</span>
<span class="font-medium text-gray-900 dark:text-white">{comparison.person_name}</span>
</div>
<div class="text-right">
<span class="text-xl font-bold text-gray-900 dark:text-white">{comparison.current_score}</span>
<span class="text-sm text-gray-500 dark:text-gray-400"> this year</span>
</div>
</div>
<div class="flex items-center justify-between text-sm">
<div class={getChangeColor(comparison.difference)}>
{#if comparison.difference !== null}
{comparison.difference > 0 ? '↑' : comparison.difference < 0 ? '↓' : '→'} 
{comparison.percentage_change !== null ? (comparison.percentage_change > 0 ? '+' : '') + comparison.percentage_change + '%' : ''} vs last year's pace
{:else}
No comparison available
{/if}
</div>
<div class="text-gray-500 dark:text-gray-400">
2025 final: {comparison.previous_score ?? 'N/A'}
</div>
</div>
{#if comparison.on_track_to_beat}
<div class="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
🎯 On track to beat 2025 record!
</div>
{/if}
</div>
{/each}
</div>
</div>
{/if}

<!-- Predictions -->
{#if data.predictions && data.predictions.length > 0}
<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
<div class="bg-gradient-to-r from-violet-500 to-purple-500 p-4">
<h2 class="text-xl font-bold text-white flex items-center gap-2">
🔮 End of Year Predictions
</h2>
<p class="text-violet-100 text-sm">Based on current pace ({data.dayOfYear} days in)</p>
</div>

<div class="p-4 space-y-3">
{#each data.predictions as prediction}
<div class="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
<div class="flex items-center justify-between">
<div class="flex items-center gap-3">
<div class="text-xl font-bold text-gray-400">#{prediction.projected_rank}</div>
<span class="text-2xl">{prediction.person_emoji}</span>
<div>
<div class="font-medium text-gray-900 dark:text-white">{prediction.person_name}</div>
<div class="text-xs text-gray-500 dark:text-gray-400">
{prediction.daily_average}/day average
</div>
</div>
</div>
<div class="text-right">
<div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
{prediction.projected_final}
</div>
<div class="text-xs text-gray-500 dark:text-gray-400">projected</div>
<span class="inline-block mt-1 px-2 py-0.5 rounded text-xs {getConfidenceColor(prediction.confidence)}">
{prediction.confidence} confidence
</span>
</div>
</div>
{#if prediction.comparison_to_2025}
<div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs">
{#if prediction.comparison_to_2025.would_beat}
<span class="text-green-600 dark:text-green-400">📈 Would beat 2025 by {prediction.comparison_to_2025.difference}</span>
{:else}
<span class="text-gray-500 dark:text-gray-400">📉 {Math.abs(prediction.comparison_to_2025.difference)} behind 2025 pace</span>
{/if}
</div>
{/if}
</div>
{/each}
</div>
</div>
{:else}
<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
<span class="text-4xl">🔮</span>
<p class="text-gray-500 dark:text-gray-400 mt-2">Start tracking to see predictions!</p>
</div>
{/if}

<!-- Personal Records -->
{#if data.personalRecords && data.personalRecords.length > 0}
<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
<div class="bg-gradient-to-r from-rose-500 to-pink-500 p-4">
<h2 class="text-xl font-bold text-white flex items-center gap-2">
⭐ Personal Records Tracker
</h2>
<p class="text-rose-100 text-sm">Track your journey to beat your personal bests</p>
</div>

<div class="p-4 space-y-3">
{#each data.personalRecords as record}
<div class="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
<div class="flex items-center justify-between mb-2">
<div class="flex items-center gap-2">
<span class="text-2xl">{record.person_emoji}</span>
<span class="font-medium text-gray-900 dark:text-white">{record.person_name}</span>
</div>
<div class="text-xs text-gray-500 dark:text-gray-400">
Record: {record.record_score} ({record.record_year})
</div>
</div>
<div class="mt-2">
<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
<span>{record.current_score} current</span>
<span>{record.percentage_of_record}% of record</span>
</div>
<div class="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
<div 
class="h-full rounded-full transition-all {record.on_track_to_beat ? 'bg-green-500' : 'bg-indigo-500'}"
style="width: {Math.min(record.percentage_of_record, 100)}%"
></div>
</div>
{#if record.on_track_to_beat}
<div class="mt-1 text-xs text-green-600 dark:text-green-400 font-medium">
🎯 On pace to set new record: {record.current_pace}
</div>
{/if}
</div>
</div>
{/each}
</div>
</div>
{/if}
{/if}

<!-- COMPARE TAB -->
{#if activeTab === 'compare'}
<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
<div class="bg-gradient-to-r from-red-500 to-orange-500 p-4">
<h2 class="text-xl font-bold text-white flex items-center gap-2">
⚔️ Head-to-Head History
</h2>
<p class="text-red-100 text-sm">Compare two people across all seasons</p>
</div>

<div class="p-4">
<!-- Person selectors -->
<div class="grid grid-cols-2 gap-4 mb-6">
<div>
<label for="fighter1" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fighter 1</label>
<select 
id="fighter1"
bind:value={comparePersons[0]}
class="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
>
<option value={null}>Select person...</option>
{#each allPersonNames as name}
<option value={name} disabled={name === comparePersons[1]}>{name}</option>
{/each}
</select>
</div>
<div>
<label for="fighter2" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fighter 2</label>
<select 
id="fighter2"
bind:value={comparePersons[1]}
class="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
>
<option value={null}>Select person...</option>
{#each allPersonNames as name}
<option value={name} disabled={name === comparePersons[0]}>{name}</option>
{/each}
</select>
</div>
</div>

{#if h2hData}
<!-- Overall record -->
<div class="text-center py-4 mb-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
<div class="flex items-center justify-center gap-4">
<div class="text-center">
<div class="text-3xl">{h2hData.person1.emoji}</div>
<div class="font-semibold text-gray-900 dark:text-white">{h2hData.person1.name}</div>
<div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{h2hData.person1.wins}</div>
</div>
<div class="text-2xl text-gray-400">vs</div>
<div class="text-center">
<div class="text-3xl">{h2hData.person2.emoji}</div>
<div class="font-semibold text-gray-900 dark:text-white">{h2hData.person2.name}</div>
<div class="text-2xl font-bold text-pink-600 dark:text-pink-400">{h2hData.person2.wins}</div>
</div>
</div>
{#if h2hData.ties > 0}
<div class="text-sm text-gray-500 dark:text-gray-400 mt-2">{h2hData.ties} tie(s)</div>
{/if}
</div>

<!-- Season by season breakdown -->
<div class="space-y-3">
{#each h2hData.seasons as season}
{@const total = (season.p1_score || 0) + (season.p2_score || 0)}
{@const p1Width = total > 0 ? ((season.p1_score || 0) / total) * 100 : 50}
<div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
<div class="flex items-center justify-between mb-2">
<div class="flex items-center gap-2">
<span class="text-xl">{season.metric_emoji}</span>
<span class="font-medium text-gray-900 dark:text-white">{season.year}</span>
<span class="text-sm text-gray-500 dark:text-gray-400">{season.metric}</span>
</div>
{#if season.winner === 1}
<span class="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-1 rounded-full">
{h2hData.person1.name} wins
</span>
{:else if season.winner === 2}
<span class="text-xs bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300 px-2 py-1 rounded-full">
{h2hData.person2.name} wins
</span>
{:else}
<span class="text-xs bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
Tie
</span>
{/if}
</div>
<div class="flex items-center gap-2">
<div class="font-bold text-indigo-600 dark:text-indigo-400 w-16 text-right">
{season.p1_score ?? 'N/A'}
</div>
<div class="flex-1 h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden flex">
<div class="h-full bg-indigo-500" style="width: {p1Width}%"></div>
<div class="h-full bg-pink-500" style="width: {100 - p1Width}%"></div>
</div>
<div class="font-bold text-pink-600 dark:text-pink-400 w-16">
{season.p2_score ?? 'N/A'}
</div>
</div>
<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
<span>Rank #{season.p1_rank}</span>
<span>Rank #{season.p2_rank}</span>
</div>
</div>
{/each}
</div>
{:else}
<div class="text-center py-8 text-gray-500 dark:text-gray-400">
<div class="text-4xl mb-2">⚔️</div>
<p>Select two people to compare their historical performance</p>
</div>
{/if}
</div>
</div>
{/if}

<!-- TIMELINE TAB -->
{#if activeTab === 'timeline'}
<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
<div class="bg-gradient-to-r from-cyan-500 to-blue-500 p-4">
<h2 class="text-xl font-bold text-white flex items-center gap-2">
📈 Performance Timeline
</h2>
<p class="text-cyan-100 text-sm">How everyone performed across seasons</p>
</div>

<div class="p-4">
{#if data.timelineData && data.timelineData.years.length > 0}
<!-- Simple visual timeline -->
<div class="space-y-4">
<!-- Year headers -->
<div class="flex items-center gap-2 mb-2">
<div class="w-24"></div>
{#each data.timelineData.years as year}
<div class="flex-1 text-center">
<div class="text-sm font-semibold text-gray-700 dark:text-gray-300">{year}</div>
<div class="text-xs text-gray-500 dark:text-gray-400">
{#if year === 2024}🎂{:else if year === 2025}🏃{/if}
</div>
</div>
{/each}
</div>

<!-- Person rows with bars -->
{#each data.timelineData.people as person}
<div class="flex items-center gap-2">
<div class="w-24 flex items-center gap-2 text-sm">
<span class="text-lg">{person.emoji}</span>
<span class="text-gray-700 dark:text-gray-300 truncate">{person.name}</span>
</div>
{#each data.timelineData.years as year}
{@const yearData = person.data.find(d => d.year === year)}
<div class="flex-1">
{#if yearData && yearData.score !== null}
<div class="relative">
<div 
class="h-8 rounded transition-all {yearData.rank === 1 ? 'bg-yellow-400' : yearData.rank === 2 ? 'bg-gray-300' : yearData.rank === 3 ? 'bg-orange-400' : 'bg-indigo-400'}"
style="width: {(yearData.score / maxTimelineScore) * 100}%"
></div>
<div class="absolute inset-0 flex items-center px-2">
<span class="text-xs font-bold {yearData.rank <= 3 ? 'text-gray-900' : 'text-white'}">
{yearData.score}
</span>
</div>
</div>
<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
#{yearData.rank}
</div>
{:else}
<div class="h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
<span class="text-xs text-gray-400">—</span>
</div>
{/if}
</div>
{/each}
</div>
{/each}
</div>

<!-- Legend -->
<div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
<div class="flex flex-wrap gap-4 text-xs">
<div class="flex items-center gap-1">
<div class="w-4 h-4 rounded bg-yellow-400"></div>
<span class="text-gray-600 dark:text-gray-400">1st Place</span>
</div>
<div class="flex items-center gap-1">
<div class="w-4 h-4 rounded bg-gray-300"></div>
<span class="text-gray-600 dark:text-gray-400">2nd Place</span>
</div>
<div class="flex items-center gap-1">
<div class="w-4 h-4 rounded bg-orange-400"></div>
<span class="text-gray-600 dark:text-gray-400">3rd Place</span>
</div>
<div class="flex items-center gap-1">
<div class="w-4 h-4 rounded bg-indigo-400"></div>
<span class="text-gray-600 dark:text-gray-400">Other</span>
</div>
</div>
</div>
{:else}
<div class="text-center py-8 text-gray-500 dark:text-gray-400">
<div class="text-4xl mb-2">📈</div>
<p>No timeline data available</p>
</div>
{/if}
</div>
</div>

<!-- Metric Evolution -->
<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
<h3 class="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
📊 Metric Evolution
</h3>
<div class="space-y-3">
{#each data.historicalSeasons || [] as season}
<div class="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
<div class="text-3xl">{season.metric_emoji}</div>
<div class="flex-1">
<div class="font-medium text-gray-900 dark:text-white">{season.year}: {season.metric}</div>
<div class="text-sm text-gray-500 dark:text-gray-400">{season.description}</div>
</div>
<div class="text-right text-sm text-gray-500 dark:text-gray-400">
{season.results.reduce((sum, r) => sum + (r.score || 0), 0)} total
</div>
</div>
{/each}
<div class="flex items-center gap-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border-2 border-indigo-200 dark:border-indigo-800">
<div class="text-3xl">🎯</div>
<div class="flex-1">
<div class="font-medium text-indigo-700 dark:text-indigo-300">2026: Current Season</div>
<div class="text-sm text-indigo-500 dark:text-indigo-400">Full tracking with this app!</div>
</div>
<a href="{base}/stats" class="text-indigo-600 dark:text-indigo-400 hover:underline text-sm">
View →
</a>
</div>
</div>
</div>
{/if}

<!-- Navigation links -->
<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
<h3 class="font-semibold text-gray-800 dark:text-white mb-4">Continue exploring</h3>
<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
<a 
href="{base}/" 
class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
>
<span class="text-2xl">📊</span>
<div>
<div class="font-medium text-gray-800 dark:text-white">Dashboard</div>
<div class="text-xs text-gray-500 dark:text-gray-400">Track today's activities</div>
</div>
</a>
<a 
href="{base}/stats" 
class="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-800"
>
<span class="text-2xl">📈</span>
<div>
<div class="font-medium text-indigo-700 dark:text-indigo-300">2026 Stats</div>
<div class="text-xs text-indigo-500 dark:text-indigo-400">See current season progress</div>
</div>
</a>
</div>
</div>
</div>
{/if}

<style>
@keyframes slide-in-from-top-2 {
from {
opacity: 0;
transform: translateY(-8px);
}
to {
opacity: 1;
transform: translateY(0);
}
}

.animate-in {
animation: slide-in-from-top-2 0.2s ease-out;
}
</style>
