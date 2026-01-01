<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { getRank, getRankDisplay } from '$lib/ranking';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let startDate = $state(data.startDate || '');
	let endDate = $state(data.endDate || '');
	let activeTab = $state<'overview' | 'monthly' | 'goals' | 'streaks' | 'calendar' | 'insights' | 'compare'>((data.activeTab as 'overview' | 'monthly' | 'goals' | 'streaks' | 'calendar' | 'insights' | 'compare') || 'overview');
	let selectedCalendarPerson = $state<number | null>(null);
	let selectedCalendarMetric = $state<number | null>(null);
	let isLoading = $state(false);
	let showMilestone = $state<{ show: boolean; emoji: string; message: string }>({ show: false, emoji: '', message: '' });
	let comparePersons = $state<[number | null, number | null]>([null, null]);
	let printMode = $state(false);

	// Group stats by person
	interface StatRow {
		personId: number;
		personName: string;
		personEmoji: string;
		metrics: Record<string, number>;
		total: number;
	}

	const statsGrid = $derived.by(() => {
		if (!data.stats || !data.metrics) return [];
		
		const grouped = new Map<number, { name: string; emoji: string; metrics: Record<string, number> }>();
		
		for (const stat of data.stats) {
			if (!grouped.has(stat.person_id)) {
				grouped.set(stat.person_id, { name: stat.person_name, emoji: stat.person_emoji || '👤', metrics: {} });
			}
			grouped.get(stat.person_id)!.metrics[stat.metric_name] = stat.count;
		}

		return Array.from(grouped.entries())
			.map(([personId, d]) => ({
				personId,
				personName: d.name,
				personEmoji: d.emoji,
				metrics: d.metrics,
				total: Object.values(d.metrics).reduce((a, b) => a + b, 0)
			}))
			.sort((a, b) => b.total - a.total);
	});

	const metricNames = $derived(data.metrics?.map((m: { name: string }) => m.name) || []);

	const metricTotals = $derived.by(() => {
		const totals: Record<string, number> = {};
		for (const metric of metricNames) {
			totals[metric] = statsGrid.reduce((sum, row) => sum + (row.metrics[metric] || 0), 0);
		}
		return totals;
	});

	// Goals progress
	const goalsMap = $derived.by(() => {
		const map = new Map<string, number>();
		for (const goal of data.goals || []) {
			map.set(`${goal.person_id}-${goal.metric_id}`, goal.target);
		}
		return map;
	});

	// Check for milestone achievements
	$effect(() => {
		if (browser && data.goals && data.stats) {
			for (const goal of data.goals) {
				const current = statsGrid.find(s => s.personId === goal.person_id)?.metrics[data.metrics?.find(m => m.id === goal.metric_id)?.name || ''] || 0;
				const progress = Math.round((current / goal.target) * 100);
				
				// Check for milestone thresholds
				const milestones = [25, 50, 75, 100];
				for (const milestone of milestones) {
					const storageKey = `milestone_${goal.person_id}_${goal.metric_id}_${milestone}`;
					if (progress >= milestone && !sessionStorage.getItem(storageKey)) {
						sessionStorage.setItem(storageKey, 'true');
						showMilestone = {
							show: true,
							emoji: milestone === 100 ? '🎉' : milestone === 75 ? '🔥' : milestone === 50 ? '⭐' : '🚀',
							message: `${goal.person_name} reached ${milestone}% of their goal!`
						};
						setTimeout(() => { showMilestone = { show: false, emoji: '', message: '' }; }, 4000);
						break;
					}
				}
			}
		}
	});

	// Monthly data grouped
	const monthlyData = $derived.by(() => {
		if (!data.monthlyStats) return [];
		
		const months = new Map<string, Map<string, number>>();
		
		for (const stat of data.monthlyStats) {
			if (!months.has(stat.month)) {
				months.set(stat.month, new Map());
			}
			const key = `${stat.person_name}-${stat.metric_name}`;
			months.get(stat.month)!.set(key, stat.count);
		}
		
		return Array.from(months.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([month, stats]) => ({
				month,
				monthLabel: formatMonth(month),
				stats: Object.fromEntries(stats)
			}));
	});

	// Trend data for chart (by metric, by month)
	const trendData = $derived.by(() => {
		if (!data.monthlyStats || !data.metrics) return {};
		
		const byMetric: Record<string, { month: string; total: number }[]> = {};
		
		for (const metric of data.metrics) {
			const monthTotals = new Map<string, number>();
			
			for (const stat of data.monthlyStats) {
				if (stat.metric_name === metric.name) {
					const current = monthTotals.get(stat.month) || 0;
					monthTotals.set(stat.month, current + stat.count);
				}
			}
			
			byMetric[metric.name] = Array.from(monthTotals.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([month, total]) => ({ month, total }));
		}
		
		return byMetric;
	});

	function formatMonth(monthStr: string): string {
		const [year, month] = monthStr.split('-');
		const date = new Date(parseInt(year), parseInt(month) - 1);
		return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}

	function getProgressPercent(personId: number, metricId: number, current: number): number {
		const target = goalsMap.get(`${personId}-${metricId}`);
		if (!target) return 0;
		return Math.min(100, Math.round((current / target) * 100));
	}

	function getExpectedProgress(): number {
		if (!data.season) return 0;
		const now = new Date();
		const yearStart = new Date(data.season.year, 0, 1);
		const yearEnd = new Date(data.season.year, 11, 31);
		const totalDays = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
		const daysPassed = (now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
		return Math.min(100, Math.round((daysPassed / totalDays) * 100));
	}

	function getDaysPassed(): number {
		if (!data.season) return 0;
		const now = new Date();
		const yearStart = new Date(data.season.year, 0, 1);
		return Math.max(1, Math.floor((now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)));
	}

	function getProjectedTotal(current: number): number {
		if (!data.season) return current;
		const daysPassed = getDaysPassed();
		if (daysPassed < 7) return 0; // Need at least a week of data for projection
		const pace = current / daysPassed;
		return Math.round(pace * 365);
	}

	function getWeeklyPace(current: number): number {
		if (!data.season) return 0;
		const daysPassed = getDaysPassed();
		if (daysPassed < 1) return 0;
		return Math.round((current / daysPassed) * 7 * 10) / 10; // One decimal
	}

	function updateDateRange() {
		isLoading = true;
		const params = new URLSearchParams();
		if (startDate) params.set('startDate', startDate);
		if (endDate) params.set('endDate', endDate);
		params.set('tab', activeTab);
		goto(`${base}/stats?${params.toString()}`).finally(() => { isLoading = false; });
	}

	function resetToFullYear() {
		if (data.season) {
			startDate = `${data.season.year}-01-01`;
			endDate = `${data.season.year}-12-31`;
			updateDateRange();
		}
	}

	function switchTab(tab: typeof activeTab) {
		activeTab = tab;
		if (browser) {
			const params = new URLSearchParams(window.location.search);
			params.set('tab', tab);
			goto(`${base}/stats?${params.toString()}`, { replaceState: true, noScroll: true });
		}
	}

	function generateShareCard(personId: number): string {
		const person = statsGrid.find(p => p.personId === personId);
		if (!person || !data.season) return '';
		
		const canvas = document.createElement('canvas');
		canvas.width = 600;
		canvas.height = 400;
		const ctx = canvas.getContext('2d');
		if (!ctx) return '';
		
		// Background gradient
		const gradient = ctx.createLinearGradient(0, 0, 600, 400);
		gradient.addColorStop(0, '#4F46E5');
		gradient.addColorStop(1, '#7C3AED');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 600, 400);
		
		// Title
		ctx.fillStyle = 'white';
		ctx.font = 'bold 32px sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText(`${person.personEmoji} ${person.personName}`, 300, 60);
		
		// Season
		ctx.font = '18px sans-serif';
		ctx.fillStyle = 'rgba(255,255,255,0.8)';
		ctx.fillText(data.season.name, 300, 90);
		
		// Stats
		let y = 150;
		ctx.font = 'bold 24px sans-serif';
		ctx.fillStyle = 'white';
		for (const metric of data.metrics || []) {
			const count = person.metrics[metric.name] || 0;
			ctx.fillText(`${metric.emoji} ${metric.name}: ${count}`, 300, y);
			y += 50;
		}
		
		// Footer
		ctx.font = '14px sans-serif';
		ctx.fillStyle = 'rgba(255,255,255,0.6)';
		ctx.fillText('Resolution Recap ' + data.season.year, 300, 380);
		
		return canvas.toDataURL('image/png');
	}

	async function shareStats(personId: number) {
		const imageUrl = generateShareCard(personId);
		if (!imageUrl) return;
		
		// Convert data URL to blob
		const response = await fetch(imageUrl);
		const blob = await response.blob();
		const file = new File([blob], 'stats.png', { type: 'image/png' });
		
		if (navigator.share && navigator.canShare?.({ files: [file] })) {
			await navigator.share({
				title: 'My Resolution Stats',
				files: [file]
			});
		} else {
			// Fallback: download the image
			const link = document.createElement('a');
			link.href = imageUrl;
			link.download = 'my-stats.png';
			link.click();
		}
	}

	function printStats() {
		printMode = true;
		setTimeout(() => {
			window.print();
			printMode = false;
		}, 100);
	}

	const expectedProgress = $derived(getExpectedProgress());

	// Comparison data for rivalry mode
	const comparisonData = $derived.by(() => {
		if (!comparePersons[0] || !comparePersons[1]) return null;
		
		const person1 = statsGrid.find(p => p.personId === comparePersons[0]);
		const person2 = statsGrid.find(p => p.personId === comparePersons[1]);
		
		if (!person1 || !person2) return null;
		
		const metrics = data.metrics || [];
		const comparison = metrics.map(metric => {
			const count1 = person1.metrics[metric.name] || 0;
			const count2 = person2.metrics[metric.name] || 0;
			return {
				metric: metric.name,
				emoji: metric.emoji,
				person1: count1,
				person2: count2,
				winner: count1 > count2 ? 1 : count2 > count1 ? 2 : 0
			};
		});
		
		return {
			person1: { id: person1.personId, name: person1.personName, emoji: person1.personEmoji, total: person1.total },
			person2: { id: person2.personId, name: person2.personName, emoji: person2.personEmoji, total: person2.total },
			comparison,
			wins1: comparison.filter(c => c.winner === 1).length,
			wins2: comparison.filter(c => c.winner === 2).length
		};
	});

	// Cumulative progress chart data
	const cumulativeChartData = $derived.by(() => {
		if (!data.cumulativeStats || !data.season) return { labels: [], datasets: [] };
		
		const people = data.people || [];
		const byPerson = new Map<number, { name: string; emoji: string; data: { date: string; value: number }[] }>();
		
		for (const entry of data.cumulativeStats) {
			if (!byPerson.has(entry.person_id)) {
				byPerson.set(entry.person_id, { name: entry.person_name, emoji: entry.person_emoji, data: [] });
			}
			byPerson.get(entry.person_id)!.data.push({ date: entry.date, value: entry.cumulative });
		}
		
		// Get all unique dates
		const allDates = [...new Set(data.cumulativeStats.map(e => e.date))].sort();
		
		return {
			labels: allDates,
			datasets: Array.from(byPerson.entries()).map(([id, d]) => ({
				personId: id,
				name: d.name,
				emoji: d.emoji,
				data: d.data
			}))
		};
	});

	// Calendar heatmap data
	const calendarData = $derived.by(() => {
		if (!data.dailyStats || !data.season) return { days: [], maxCount: 0, weeks: [] };
		
		const year = data.season.year;
		const countMap = new Map<string, number>();
		
		// Filter by selected person and/or metric
		// Note: dailyStats doesn't have metric info, so we'll need to filter differently
		// For now, filter by person only in calendar view
		for (const stat of data.dailyStats) {
			if (selectedCalendarPerson && stat.person_id !== selectedCalendarPerson) continue;
			const current = countMap.get(stat.date) || 0;
			countMap.set(stat.date, current + stat.count);
		}
		
		// Helper to format date as YYYY-MM-DD without timezone issues
		function formatDate(date: Date): string {
			const y = date.getFullYear();
			const m = String(date.getMonth() + 1).padStart(2, '0');
			const d = String(date.getDate()).padStart(2, '0');
			return `${y}-${m}-${d}`;
		}
		
		// Convert Sunday=0 to Monday=0 format
		function getMondayBasedDay(date: Date): number {
			const day = date.getDay();
			return day === 0 ? 6 : day - 1; // Sunday becomes 6, Monday becomes 0
		}
		
		// Generate all days of the year - explicitly from Jan 1 to Dec 31
		const weeks: ({ date: string; count: number } | null)[][] = [];
		let currentWeek: ({ date: string; count: number } | null)[] = [];
		let maxCount = 0;
		const allDays: { date: string; count: number; dayOfWeek: number }[] = [];
		
		// Start at January 1st
		const startDate = new Date(year, 0, 1); // Month is 0-indexed, so 0 = January
		const endDate = new Date(year, 11, 31); // 11 = December
		
		// Fill in empty slots before Jan 1 (days from prev year to complete the week)
		const firstDayOfWeek = getMondayBasedDay(startDate);
		for (let i = 0; i < firstDayOfWeek; i++) {
			currentWeek.push(null);
		}
		
		// Iterate through every day of the year
		let currentDate = new Date(startDate);
		while (currentDate <= endDate) {
			const dateStr = formatDate(currentDate);
			const count = countMap.get(dateStr) || 0;
			const dayOfWeek = getMondayBasedDay(currentDate);
			
			if (count > maxCount) maxCount = count;
			
			allDays.push({ date: dateStr, count, dayOfWeek });
			currentWeek.push({ date: dateStr, count });
			
			// If Sunday (now index 6), push week and start new one
			if (dayOfWeek === 6) {
				weeks.push(currentWeek);
				currentWeek = [];
			}
			
			// Move to next day
			currentDate.setDate(currentDate.getDate() + 1);
		}
		
		// Push final partial week (days after Dec 31 to complete the week)
		if (currentWeek.length > 0) {
			while (currentWeek.length < 7) {
				currentWeek.push(null);
			}
			weeks.push(currentWeek);
		}
		
return { days: allDays, maxCount, weeks };
	});

	function getHeatmapColor(count: number, maxCount: number, isOddMonth: boolean): string {
		if (count === 0) {
			// Alternating gray tones for empty days
			return isOddMonth ? 'bg-gray-200 dark:bg-gray-600' : 'bg-slate-200 dark:bg-slate-500';
		}
		if (maxCount === 0) {
			return isOddMonth ? 'bg-gray-200 dark:bg-gray-600' : 'bg-slate-200 dark:bg-slate-500';
		}
		const intensity = count / maxCount;
		// Alternating color families: green vs teal
		if (isOddMonth) {
			if (intensity <= 0.25) return 'bg-green-200 dark:bg-green-900';
			if (intensity <= 0.5) return 'bg-green-400 dark:bg-green-700';
			if (intensity <= 0.75) return 'bg-green-500 dark:bg-green-500';
			return 'bg-green-600 dark:bg-green-400';
		} else {
			if (intensity <= 0.25) return 'bg-teal-200 dark:bg-teal-900';
			if (intensity <= 0.5) return 'bg-teal-400 dark:bg-teal-700';
			if (intensity <= 0.75) return 'bg-teal-500 dark:bg-teal-500';
			return 'bg-teal-600 dark:bg-teal-400';
		}
	}

	function formatDateForTooltip(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	// Calculate month label positions (Monday-based weeks)
	const monthLabels = $derived.by(() => {
		if (!data.season || !calendarData.weeks.length) return [];
		
		const year = data.season.year;
		const labels: { month: string; weekIndex: number }[] = [];
		const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		
		// Convert Sunday=0 to Monday=0 format
		function getMondayBasedDay(date: Date): number {
			const day = date.getDay();
			return day === 0 ? 6 : day - 1;
		}
		
		for (let m = 0; m < 12; m++) {
			const firstOfMonth = new Date(year, m, 1);
			// Find which week this falls into (Monday-based)
			const dayOfYear = Math.floor((firstOfMonth.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24));
			const startDayOfWeek = getMondayBasedDay(new Date(year, 0, 1));
			const weekIndex = Math.floor((dayOfYear + startDayOfWeek) / 7);
			
			labels.push({ month: monthNames[m], weekIndex });
		}
		
		return labels;
	});
</script>

<!-- Milestone celebration overlay -->
{#if showMilestone.show}
	<div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-fade-in">
		<div class="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-6 rounded-2xl shadow-2xl transform animate-bounce-in">
			<div class="text-6xl text-center mb-2">{showMilestone.emoji}</div>
			<div class="text-xl font-bold text-center">{showMilestone.message}</div>
		</div>
	</div>
{/if}

<!-- Loading overlay -->
{#if isLoading}
	<div class="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 flex items-center justify-center">
		<div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl">
			<div class="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
			<p class="text-gray-600 dark:text-gray-300 mt-3">Loading...</p>
		</div>
	</div>
{/if}

<div class="space-y-6 {printMode ? 'print-mode' : ''}">
	<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transition-colors duration-200">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold text-gray-800 dark:text-white mb-1">📈 Stats</h1>
				{#if data.season}
					<p class="text-gray-500 dark:text-gray-400">{data.season.name}</p>
				{/if}
			</div>
			<div class="flex gap-2 print:hidden">
				<button
					onclick={printStats}
					class="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
					title="Print stats"
				>
					🖨️ Print
				</button>
			</div>
		</div>
		
		<!-- Streak warnings -->
		{#if data.streakWarnings && data.streakWarnings.length > 0}
			<div class="mt-4 p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-lg">
				<div class="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">🔥 Streak at risk!</div>
				<div class="space-y-1">
					{#each data.streakWarnings as warning}
						<div class="text-sm text-orange-700 dark:text-orange-300">
							{warning.person_emoji} {warning.person_name}: Log {warning.metric_emoji} {warning.metric_name} today to keep your {warning.current_streak}-day streak!
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	{#if !data.season}
		<div class="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 text-yellow-800 dark:text-yellow-200">
			No active season. Ask an admin to set one up.
		</div>
	{:else}
		<!-- Tab navigation -->
		<div class="flex gap-2 overflow-x-auto pb-2 print:hidden">
			<button
				onclick={() => switchTab('overview')}
				class="px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap {activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
			>
				🏆 Overview
			</button>
			<button
				onclick={() => switchTab('goals')}
				class="px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap {activeTab === 'goals' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
			>
				🎯 Goals
			</button>
			<button
				onclick={() => switchTab('monthly')}
				class="px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap {activeTab === 'monthly' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
			>
				📅 Monthly
			</button>
			<button
				onclick={() => switchTab('streaks')}
				class="px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap {activeTab === 'streaks' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
			>
				🔥 Streaks
			</button>
			<button
				onclick={() => switchTab('calendar')}
				class="px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap {activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
			>
				📆 Calendar
			</button>
			<button
				onclick={() => switchTab('insights')}
				class="px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap {activeTab === 'insights' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
			>
				💡 Insights
			</button>
			<button
				onclick={() => switchTab('compare')}
				class="px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap {activeTab === 'compare' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
			>
				⚔️ Compare
			</button>
		</div>

		{#if activeTab === 'overview'}
			<!-- Date filter -->
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4 transition-colors duration-200">
				<h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Filter by Date Range</h3>
				<div class="flex flex-col sm:flex-row gap-3">
					<div class="flex-1">
						<input
							type="date"
							bind:value={startDate}
							class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
						/>
					</div>
					<div class="flex items-center justify-center text-gray-400 dark:text-gray-500">to</div>
					<div class="flex-1">
						<input
							type="date"
							bind:value={endDate}
							class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
						/>
					</div>
					<button
						onclick={updateDateRange}
						class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
					>
						Apply
					</button>
					<button
						onclick={resetToFullYear}
						class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
					>
						Reset
					</button>
				</div>
			</div>

			{#if statsGrid.length === 0}
				<div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400">
					No data in this date range.
				</div>
			{:else}
				<!-- Summary cards with animation -->
				<div class="grid grid-cols-2 gap-4">
					{#each data.metrics || [] as metric, i}
						<div 
							class="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center transform transition-all duration-300 hover:scale-105 hover:shadow-lg"
							style="animation: slideUp 0.3s ease-out {i * 0.1}s both"
						>
							<div class="text-2xl mb-1">{metric.emoji}</div>
							<div class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{metricTotals[metric.name] || 0}</div>
							<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Total {metric.name}</div>
						</div>
					{/each}
				</div>

				<!-- Per-metric Leaderboards -->
				{#each data.metrics || [] as metric}
					{@const metricRanking = statsGrid
						.map(row => ({ ...row, count: row.metrics[metric.name] || 0 }))
						.filter(row => row.count > 0)
						.sort((a, b) => b.count - a.count)}
					{@const projectedRanking = statsGrid
						.map(row => ({ 
							personId: row.personId, 
							projected: getProjectedTotal(row.metrics[metric.name] || 0)
						}))
						.filter(row => row.projected > 0)
						.sort((a, b) => b.projected - a.projected)}
					{@const getProjectedRank = (personId: number) => projectedRanking.findIndex(r => r.personId === personId) + 1}
					{@const trend = trendData[metric.name] || []}
					{@const maxVal = Math.max(...trend.map(t => t.total), 1)}
					{@const daysPassed = getDaysPassed()}
					
					<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-colors duration-200">
						<div class="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="text-xl">{metric.emoji}</span>
								<h3 class="font-semibold text-indigo-800 dark:text-indigo-300">{metric.name} Leaderboard</h3>
							</div>
							{#if metricRanking.length > 0}
								<button
									onclick={() => shareStats(metricRanking[0].personId)}
									class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline print:hidden"
									title="Share stats"
								>
									📤 Share
								</button>
							{/if}
						</div>
						
						{#if metricRanking.length === 0}
							<div class="p-6 text-center text-gray-500 dark:text-gray-400">
								No entries yet for {metric.name}
							</div>
						{:else}
							<div class="divide-y dark:divide-gray-700">
								{#each metricRanking as row, i}
									{@const rank = getRank(i, metricRanking, r => r.count)}
									{@const weeklyPace = getWeeklyPace(row.count)}
									{@const projected = getProjectedTotal(row.count)}
									{@const expectedRank = getProjectedRank(row.personId)}
									{@const rankChange = rank - expectedRank}
									<a 
										href="{base}/person/{row.personId}"
										class="flex items-center px-4 py-3 gap-3 {rank === 1 ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
									>
										<div class="text-2xl w-8 text-center shrink-0">
											{getRankDisplay(rank)}
										</div>
										<div class="text-2xl shrink-0">{row.personEmoji}</div>
										<div class="flex-1 min-w-0">
											<div class="font-medium text-gray-800 dark:text-white">{row.personName}</div>
											{#if daysPassed >= 7}
												<div class="text-xs text-gray-500 dark:text-gray-400">
													📈 {weeklyPace}/week → {projected}
												</div>
											{/if}
										</div>
										<div class="text-right shrink-0">
											<div class="text-xl font-bold text-indigo-600 dark:text-indigo-400">{row.count}</div>
											{#if daysPassed >= 7 && expectedRank > 0}
												<div class="text-xs {rankChange > 0 ? 'text-green-600 dark:text-green-400' : rankChange < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}">
													{#if rankChange > 0}
														↑{rankChange} to #{expectedRank}
													{:else if rankChange < 0}
														↓{Math.abs(rankChange)} to #{expectedRank}
													{:else}
														→ #{expectedRank}
													{/if}
												</div>
											{/if}
										</div>
									</a>
								{/each}
							</div>
						{/if}
						
						<!-- Trend mini-chart -->
						{#if trend.length > 0}
							<div class="border-t dark:border-gray-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900/50 dark:to-gray-800/30 p-3">
								<div class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
									<span>📈</span> Monthly trend
								</div>
								<div class="flex items-end gap-2 h-16 px-1">
									{#each trend as point, idx}
										{@const barHeight = Math.max(8, (point.total / maxVal) * 100)}
										{@const isLast = idx === trend.length - 1}
										<div class="flex-1 flex flex-col items-center group relative">
											<div 
												class="w-full rounded-md transition-all duration-500 hover:scale-105 relative overflow-hidden {isLast ? 'bg-gradient-to-t from-indigo-500 to-indigo-400 dark:from-indigo-500 dark:to-indigo-400 shadow-lg shadow-indigo-500/30' : 'bg-gradient-to-t from-indigo-300 to-indigo-200 dark:from-indigo-600 dark:to-indigo-500'}"
												style="height: {barHeight}%; min-height: 4px"
											>
												{#if point.total > 0 && barHeight > 25}
													<div class="absolute inset-0 flex items-center justify-center">
														<span class="text-[8px] font-bold text-white drop-shadow">{point.total}</span>
													</div>
												{/if}
											</div>
											<div class="text-[9px] text-gray-400 mt-1">{point.month.split('-')[1]}</div>
											<div class="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
												{formatMonth(point.month)}: {point.total}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/each}

				<!-- Sports Progression Graph -->
				{#if (data.sportStatsByPerson || []).length > 0 || (data.sportTotals || []).length > 0}
					<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-colors duration-200">
						<div class="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 px-4 py-3 border-b dark:border-gray-700">
							<h3 class="font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-2">
								<span>🏃</span>
								Sports Progression
							</h3>
						</div>
						
						<div class="p-4">
							<!-- Per-Person Trend Chart with Projections -->
							{#if (data.sportStatsByPerson || []).length > 0}
								{@const personColors = ['#f97316', '#06b6d4', '#8b5cf6', '#10b981', '#ec4899', '#eab308']}
								{@const today = new Date()}
								{@const yearStart = new Date(data.season?.year || today.getFullYear(), 0, 1)}
								{@const yearEnd = new Date(data.season?.year || today.getFullYear(), 11, 31)}
								{@const totalDaysInYear = 365}
								{@const daysPassed = Math.max(1, Math.floor((today.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1)}
								{@const progressPercent = Math.min(100, (daysPassed / totalDaysInYear) * 100)}
								{@const maxCurrent = Math.max(...(data.sportStatsByPerson || []).map(p => p.total), 1)}
								{@const maxProjected = Math.max(...(data.sportStatsByPerson || []).map(p => Math.round((p.total / daysPassed) * totalDaysInYear)), maxCurrent * 1.5, 10)}
								
								<div class="mb-6">
									<div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center justify-between">
										<span>📈 Year Progress & Projections</span>
										<span class="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full">
											Day {daysPassed} of {totalDaysInYear}
										</span>
									</div>
									
									<!-- Progress bar for year -->
									<div class="mb-4">
										<div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
											<div 
												class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
												style="width: {progressPercent}%"
											></div>
										</div>
										<div class="flex justify-between text-xs text-gray-400 mt-1">
											<span>Jan 1</span>
											<span>{Math.round(progressPercent)}% of year</span>
											<span>Dec 31</span>
										</div>
									</div>
									
									<!-- Person Cards with Visual Progress -->
									<div class="grid gap-4">
										{#each data.sportStatsByPerson as person, i}
											{@const color = personColors[i % personColors.length]}
											{@const projected = Math.round((person.total / daysPassed) * totalDaysInYear)}
											{@const weeklyPace = ((person.total / daysPassed) * 7).toFixed(1)}
											{@const dailyPace = (person.total / daysPassed).toFixed(2)}
											{@const progressWidth = Math.min(100, (person.total / maxProjected) * 100)}
											{@const projectedWidth = Math.min(100, (projected / maxProjected) * 100)}
											
											<div class="bg-white dark:bg-gray-700/50 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-600">
												<!-- Header -->
												<div class="flex items-center justify-between mb-3">
													<div class="flex items-center gap-3">
														<div 
															class="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
															style="background: linear-gradient(135deg, {color}20, {color}40)"
														>
															{person.person_emoji}
														</div>
														<div>
															<div class="font-semibold text-gray-800 dark:text-white">{person.person_name}</div>
															<div class="text-xs text-gray-500 dark:text-gray-400">
																{person.days_active} active {person.days_active === 1 ? 'day' : 'days'}
															</div>
														</div>
													</div>
													<div class="text-right">
														<div class="text-3xl font-bold" style="color: {color}">{person.total}</div>
														<div class="text-xs text-gray-500 dark:text-gray-400">activities</div>
													</div>
												</div>
												
												<!-- Visual Progress Bar -->
												<div class="mb-3">
													<div class="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden relative">
														<!-- Projected (background) -->
														<div 
															class="absolute inset-y-0 left-0 opacity-30 rounded-lg"
															style="width: {projectedWidth}%; background: {color}"
														></div>
														<!-- Actual (foreground) -->
														<div 
															class="absolute inset-y-0 left-0 rounded-lg flex items-center justify-end pr-2 transition-all duration-700"
															style="width: {progressWidth}%; background: linear-gradient(90deg, {color}, {color}dd)"
														>
															{#if progressWidth > 15}
																<span class="text-white text-xs font-bold drop-shadow">{person.total}</span>
															{/if}
														</div>
														<!-- Projected marker -->
														<div 
															class="absolute top-0 bottom-0 w-0.5 bg-gray-600 dark:bg-gray-300"
															style="left: {projectedWidth}%"
														></div>
														<div 
															class="absolute -top-5 text-[10px] font-medium transform -translate-x-1/2"
															style="left: {projectedWidth}%; color: {color}"
														>
															→{projected}
														</div>
													</div>
													<div class="flex justify-between text-xs text-gray-400 mt-1">
														<span>Current: {person.total}</span>
														<span>Projected: {projected}</span>
													</div>
												</div>
												
												<!-- Stats Row -->
												<div class="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-gray-600">
													<div class="text-center">
														<div class="text-lg font-bold text-gray-700 dark:text-gray-200">{weeklyPace}</div>
														<div class="text-xs text-gray-500 dark:text-gray-400">per week</div>
													</div>
													<div class="text-center">
														<div class="text-lg font-bold text-gray-700 dark:text-gray-200">{dailyPace}</div>
														<div class="text-xs text-gray-500 dark:text-gray-400">per day</div>
													</div>
													<div class="text-center">
														<div class="text-lg font-bold" style="color: {color}">{projected}</div>
														<div class="text-xs text-gray-500 dark:text-gray-400">year-end</div>
													</div>
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
							
							<!-- Sport Type Breakdown (if we have sport types) -->
							{#if (data.sportTotals || []).length > 0}
								<div class="border-t dark:border-gray-700 pt-4 mt-2">
									<div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Activity Types</div>
									
									<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
										{#each data.sportTotals as sport, i}
											<div 
												class="bg-gradient-to-br from-orange-100 to-amber-100 dark:from-gray-700 dark:to-gray-700 dark:border dark:border-orange-500/30 rounded-lg p-3 text-center transform transition-all duration-300 hover:scale-105"
												style="animation: slideUp 0.3s ease-out {i * 0.08}s both"
											>
												<div class="text-2xl mb-1">{sport.emoji}</div>
												<div class="text-xl font-bold text-orange-600 dark:text-orange-400">{sport.total}</div>
												<div class="text-xs text-gray-600 dark:text-gray-300 capitalize">{sport.tag}</div>
												<div class="text-xs text-gray-500 dark:text-gray-400">{sport.percentage}%</div>
											</div>
										{/each}
									</div>
									
									<!-- Distribution Bar -->
									<div class="h-6 bg-gray-200 dark:bg-gray-900 rounded-full overflow-hidden flex shadow-inner">
										{#each data.sportTotals as sport, i}
											{@const colors = ['bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-red-500', 'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500', 'bg-teal-500', 'bg-green-500']}
											<div 
												class="h-full {colors[i % colors.length]} relative group transition-all duration-300 hover:brightness-110"
												style="width: {sport.percentage}%"
												title="{sport.tag}: {sport.total} ({sport.percentage}%)"
											>
												{#if sport.percentage >= 12}
													<span class="absolute inset-0 flex items-center justify-center text-white text-xs font-medium drop-shadow-sm">
														{sport.emoji}
													</span>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			{/if}

		{:else if activeTab === 'goals'}
			<!-- Goals Progress -->
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-colors duration-200">
				<div class="bg-green-50 dark:bg-green-900/30 px-4 py-3 border-b dark:border-gray-700 flex justify-between items-center">
					<h3 class="font-semibold text-green-800 dark:text-green-300">🎯 Goal Progress</h3>
					<div class="text-sm text-green-600 dark:text-green-400">
						Year is {expectedProgress}% complete
					</div>
				</div>
				
				{#if (data.goals || []).length === 0}
					<div class="p-8 text-center text-gray-500 dark:text-gray-400">
						<p class="mb-2">No goals set yet.</p>
						<p class="text-sm">Set goals in Settings to track progress here.</p>
					</div>
				{:else}
					<div class="p-4 space-y-6">
						{#each data.metrics || [] as metric}
							{@const metricGoals = (data.goals || []).filter((g: { metric_id: number }) => g.metric_id === metric.id)}
							{#if metricGoals.length > 0}
								<div>
									<div class="flex items-center gap-2 mb-3">
										<span class="text-xl">{metric.emoji}</span>
										<h4 class="font-medium text-gray-800 dark:text-white">{metric.name}</h4>
									</div>
									<div class="space-y-3">
										{#each metricGoals as goal}
											{@const current = statsGrid.find(s => s.personId === goal.person_id)?.metrics[metric.name] || 0}
											{@const progress = getProgressPercent(goal.person_id, goal.metric_id, current)}
											{@const expectedCount = Math.round((expectedProgress / 100) * goal.target)}
											{@const isAhead = current >= expectedCount}
											{@const behind = expectedCount - current}
											{@const projected = getProjectedTotal(current)}
											{@const weeklyPace = getWeeklyPace(current)}
											{@const daysPassed = getDaysPassed()}
											{@const willHitGoal = projected >= goal.target}
											<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 transition-colors duration-200">
												<div class="flex items-center justify-between mb-2">
													<div class="flex items-center gap-2">
														<span>{goal.person_emoji}</span>
														<span class="font-medium text-gray-800 dark:text-white">{goal.person_name}</span>
													</div>
													<div class="text-sm">
														<span class="font-bold {isAhead ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'}">{current}</span>
														<span class="text-gray-400 dark:text-gray-500">/ {goal.target}</span>
													</div>
												</div>
												<div class="relative h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
													<div 
														class="absolute h-full rounded-full transition-all duration-1000 ease-out {isAhead ? 'bg-green-500' : 'bg-orange-400'}"
														style="width: {progress}%; animation: progressGrow 1s ease-out"
													></div>
													<!-- Expected progress marker -->
													<div 
														class="absolute h-full w-0.5 bg-gray-600 dark:bg-gray-300 opacity-50"
														style="left: {expectedProgress}%"
														title="Expected: {expectedProgress}%"
													></div>
												</div>
												<div class="flex justify-between text-xs mt-1 text-gray-500 dark:text-gray-400">
													<span>{progress}% done</span>
													<span class="{current === 0 ? 'text-blue-500 dark:text-blue-400' : isAhead ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'}">
														{#if current === 0}
															🚀 Let's get going!
														{:else if isAhead}
															✓ On track
														{:else if behind === 1}
															1 behind
														{:else}
															{behind} behind
														{/if}
													</span>
												</div>
												<!-- Trend projection (only show after 7+ days with activity) -->
												{#if daysPassed >= 7 && current > 0}
													<div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs">
														<div class="flex justify-between items-center">
															<span class="text-gray-500 dark:text-gray-400">
																📈 Pace: {weeklyPace}/week
															</span>
															<span class="{willHitGoal ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'}">
																{#if willHitGoal}
																	Projected: {projected} ✓
																{:else}
																	Projected: {projected} (need {goal.target - projected} more)
																{/if}
															</span>
														</div>
													</div>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>

			<!-- Cumulative Progress Chart -->
			{#if cumulativeChartData.datasets.length > 0}
				{@const maxValue = Math.max(...cumulativeChartData.datasets.flatMap(d => d.data.map(p => p.value)), 1)}
				{@const labels = cumulativeChartData.labels}
				{@const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']}
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 transition-colors duration-200">
					<div class="flex items-center justify-between mb-4">
						<h3 class="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
							<span>📊</span> Cumulative Progress
						</h3>
						<div class="text-xs text-gray-500 dark:text-gray-400">
							{labels.length} days tracked
						</div>
					</div>
					
					<!-- Legend at top -->
					<div class="flex flex-wrap gap-4 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
						{#each cumulativeChartData.datasets as dataset, i}
							{@const color = colors[i % 6]}
							{@const latestValue = dataset.data[dataset.data.length - 1]?.value || 0}
							<div class="flex items-center gap-2">
								<div class="w-3 h-3 rounded-full" style="background-color: {color}"></div>
								<span class="text-sm text-gray-700 dark:text-gray-300">
									{dataset.emoji} {dataset.name}
								</span>
								<span class="text-sm font-bold" style="color: {color}">{latestValue}</span>
							</div>
						{/each}
					</div>
					
					<div class="h-56 relative">
						<svg class="w-full h-full" viewBox="0 0 800 220" preserveAspectRatio="xMidYMid meet">
							<defs>
								<!-- Gradient definitions for each line -->
								{#each colors as color, i}
									<linearGradient id="lineGrad{i}" x1="0%" y1="0%" x2="0%" y2="100%">
										<stop offset="0%" stop-color="{color}" stop-opacity="0.3"/>
										<stop offset="100%" stop-color="{color}" stop-opacity="0.05"/>
									</linearGradient>
								{/each}
							</defs>
							
							<!-- Background -->
							<rect x="50" y="10" width="730" height="180" fill="none" rx="8"/>
							
							<!-- Horizontal grid lines -->
							{#each [0, 0.25, 0.5, 0.75, 1] as ratio}
								<line 
									x1="50" y1={190 - ratio * 170} 
									x2="780" y2={190 - ratio * 170} 
									stroke="currentColor" 
									class="text-gray-100 dark:text-gray-700"
									stroke-width="1"
									stroke-dasharray={ratio === 0 ? "0" : "4,4"}
								/>
								<text x="42" y={194 - ratio * 170} class="text-[10px] fill-gray-400 dark:fill-gray-500" text-anchor="end">
									{Math.round(maxValue * ratio)}
								</text>
							{/each}
							
							<!-- Area fills (behind lines) -->
							{#each cumulativeChartData.datasets as dataset, i}
								{@const color = colors[i % 6]}
								{@const points = dataset.data.map((point, idx) => {
									const x = 50 + (labels.indexOf(point.date) / Math.max(labels.length - 1, 1)) * 730;
									const y = 190 - (point.value / maxValue) * 170;
									return `${x},${y}`;
								}).join(' ')}
								{@const firstX = 50 + (labels.indexOf(dataset.data[0]?.date || '') / Math.max(labels.length - 1, 1)) * 730}
								{@const lastX = 50 + (labels.indexOf(dataset.data[dataset.data.length - 1]?.date || '') / Math.max(labels.length - 1, 1)) * 730}
								<polygon
									fill="url(#lineGrad{i})"
									points="{firstX},190 {points} {lastX},190"
									opacity="0.5"
								/>
							{/each}
							
							<!-- Lines for each person -->
							{#each cumulativeChartData.datasets as dataset, i}
								{@const color = colors[i % 6]}
								<polyline
									fill="none"
									stroke={color}
									stroke-width="3"
									stroke-linecap="round"
									stroke-linejoin="round"
									points={dataset.data.map((point, idx) => {
										const x = 50 + (labels.indexOf(point.date) / Math.max(labels.length - 1, 1)) * 730;
										const y = 190 - (point.value / maxValue) * 170;
										return `${x},${y}`;
									}).join(' ')}
									class="transition-all duration-500 drop-shadow-sm"
								/>
								
								<!-- End point marker -->
								{@const lastPoint = dataset.data[dataset.data.length - 1]}
								{#if lastPoint}
									{@const lastX = 50 + (labels.indexOf(lastPoint.date) / Math.max(labels.length - 1, 1)) * 730}
									{@const lastY = 190 - (lastPoint.value / maxValue) * 170}
									<circle 
										cx={lastX} 
										cy={lastY} 
										r="6" 
										fill={color}
										stroke="white"
										stroke-width="2"
										class="drop-shadow"
									/>
								{/if}
							{/each}
							
							<!-- X-axis labels -->
							{#if labels.length > 0}
								<text x="50" y="208" class="text-[10px] fill-gray-400 dark:fill-gray-500">{labels[0]}</text>
								{#if labels.length > 1}
									<text x="780" y="208" class="text-[10px] fill-gray-400 dark:fill-gray-500" text-anchor="end">{labels[labels.length - 1]}</text>
								{/if}
							{/if}
						</svg>
					</div>
				</div>
			{/if}

			<!-- Link to set goals -->
			<a href="{base}/settings" class="block bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-blue-800 dark:text-blue-200 text-center hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
				⚙️ Set or update goals in Settings
			</a>

		{:else if activeTab === 'monthly'}
			<!-- Monthly Overview -->
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-colors duration-200">
				<div class="bg-amber-50 dark:bg-amber-900/30 px-4 py-3 border-b dark:border-gray-700">
					<h3 class="font-semibold text-amber-800 dark:text-amber-300">📅 Monthly Breakdown</h3>
				</div>
				
				{#if monthlyData.length === 0}
					<div class="p-8 text-center text-gray-500 dark:text-gray-400">
						No entries yet this season.
					</div>
				{:else}
					<div class="divide-y dark:divide-gray-700">
						{#each monthlyData as monthEntry}
							<div class="p-4">
								<h4 class="font-bold text-gray-800 dark:text-white mb-3">{monthEntry.monthLabel}</h4>
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
									{#each data.metrics || [] as metric}
										<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
											<div class="flex items-center gap-2 mb-2">
												<span>{metric.emoji}</span>
												<span class="font-medium text-sm text-gray-700 dark:text-gray-300">{metric.name}</span>
											</div>
											<div class="space-y-1">
												{#each statsGrid as person}
													{@const count = monthEntry.stats[`${person.personName}-${metric.name}`] || 0}
													{#if count > 0}
														<div class="flex items-center justify-between text-sm">
															<span class="text-gray-700 dark:text-gray-300">{person.personEmoji} {person.personName}</span>
															<span class="font-medium text-indigo-600 dark:text-indigo-400">{count}</span>
														</div>
													{/if}
												{/each}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

		{:else if activeTab === 'streaks'}
			<!-- Streak Warnings (if any streaks at risk) -->
			{#if (data.streakWarnings || []).length > 0}
				<div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-4 mb-4">
					<h3 class="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-3">
						<span>⚠️</span>
						Streaks at Risk!
					</h3>
					<div class="grid gap-2">
						{#each data.streakWarnings as warning}
							<div class="flex items-center gap-3 bg-white/50 dark:bg-gray-800/50 rounded-lg p-2">
								<span class="text-xl">{warning.person_emoji}</span>
								<div class="flex-1">
									<span class="font-medium text-gray-800 dark:text-white">{warning.person_name}</span>
									<span class="text-gray-500 dark:text-gray-400"> has a </span>
									<span class="font-bold text-amber-600 dark:text-amber-400">{warning.current_streak} day</span>
									<span class="text-gray-500 dark:text-gray-400"> {warning.metric_emoji} {warning.metric_name} streak!</span>
								</div>
								<div class="text-xs text-amber-600 dark:text-amber-400 font-medium">
									Log today to keep it going!
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
			
			<!-- Streaks Overview Card -->
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-4 transition-colors duration-200">
				<h3 class="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
					<span>🔥</span>
					Streaks Overview
				</h3>
				
				{#if data.metrics}
					{@const allStreakData = (data.metrics || []).flatMap(m => (data.streaks?.[m.id] || []).map(s => ({ ...s, metric: m })))}
					{@const activeDailyStreaks = allStreakData.filter(s => s.current_daily_streak >= 2).sort((a, b) => b.current_daily_streak - a.current_daily_streak)}
					{@const activeWeeklyStreaks = allStreakData.filter(s => s.current_weekly_streak >= 2).sort((a, b) => b.current_weekly_streak - a.current_weekly_streak)}
					{@const bestDailyStreak = allStreakData.reduce((best, s) => s.longest_daily_streak > (best?.longest_daily_streak || 0) ? s : best, null as (typeof allStreakData[0] | null))}
					{@const bestWeeklyStreak = allStreakData.reduce((best, s) => s.longest_weekly_streak > (best?.longest_weekly_streak || 0) ? s : best, null as (typeof allStreakData[0] | null))}
					
					{#if activeDailyStreaks.length === 0 && activeWeeklyStreaks.length === 0}
						<div class="text-center py-8">
							<div class="text-5xl mb-4">🚀</div>
							<div class="text-gray-600 dark:text-gray-300 font-medium mb-2">No active streaks yet!</div>
							<div class="text-sm text-gray-400 dark:text-gray-500">Log activities on consecutive days to start building streaks</div>
							<div class="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-sm text-indigo-700 dark:text-indigo-300">
								💡 <strong>Tip:</strong> A streak starts when you log the same type of activity 2+ days in a row!
							</div>
						</div>
					{:else}
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<!-- Active Daily Streaks -->
						{#if activeDailyStreaks.length > 0}
							<div class="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-4">
								<div class="text-sm font-medium text-orange-700 dark:text-orange-300 mb-3">🔥 Active Daily Streaks</div>
								<div class="space-y-2">
									{#each activeDailyStreaks.slice(0, 5) as streak}
										<div class="flex items-center gap-2 bg-white/70 dark:bg-gray-800/70 rounded-lg p-2">
											<span class="text-lg">{streak.person_emoji}</span>
											<span class="text-sm text-gray-600 dark:text-gray-400">{streak.metric.emoji}</span>
											<span class="flex-1 text-sm font-medium text-gray-800 dark:text-white">{streak.person_name}</span>
											<span class="font-bold text-orange-600 dark:text-orange-400">{streak.current_daily_streak}d</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}
						
						<!-- Active Weekly Streaks -->
						{#if activeWeeklyStreaks.length > 0}
							<div class="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4">
								<div class="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3">📅 Active Weekly Streaks</div>
								<div class="space-y-2">
									{#each activeWeeklyStreaks.slice(0, 5) as streak}
										<div class="flex items-center gap-2 bg-white/70 dark:bg-gray-800/70 rounded-lg p-2">
											<span class="text-lg">{streak.person_emoji}</span>
											<span class="text-sm text-gray-600 dark:text-gray-400">{streak.metric.emoji}</span>
											<span class="flex-1 text-sm font-medium text-gray-800 dark:text-white">{streak.person_name}</span>
											<span class="font-bold text-blue-600 dark:text-blue-400">{streak.current_weekly_streak}w</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
					
					<!-- All-Time Records -->
					{#if bestDailyStreak || bestWeeklyStreak}
						<div class="mt-4 pt-4 border-t dark:border-gray-700">
							<div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">🏆 All-Time Records</div>
							<div class="grid grid-cols-2 gap-3">
								{#if bestDailyStreak && bestDailyStreak.longest_daily_streak > 1}
									<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
										<div class="text-2xl mb-1">{bestDailyStreak.person_emoji}</div>
										<div class="text-2xl font-bold text-orange-600 dark:text-orange-400">{bestDailyStreak.longest_daily_streak}</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">days ({bestDailyStreak.metric.emoji} {bestDailyStreak.metric.name})</div>
									</div>
								{/if}
								{#if bestWeeklyStreak && bestWeeklyStreak.longest_weekly_streak > 1}
									<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
										<div class="text-2xl mb-1">{bestWeeklyStreak.person_emoji}</div>
										<div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{bestWeeklyStreak.longest_weekly_streak}</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">weeks ({bestWeeklyStreak.metric.emoji} {bestWeeklyStreak.metric.name})</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}
					{/if}
				{/if}
			</div>
			
			<!-- Per-Metric Streaks -->
			{#each data.metrics || [] as metric}
				{@const streaks = data.streaks?.[metric.id] || []}
				{@const dailyChamp = [...streaks].sort((a, b) => b.longest_daily_streak - a.longest_daily_streak)[0]}
				{@const weeklyChamp = [...streaks].sort((a, b) => b.longest_weekly_streak - a.longest_weekly_streak)[0]}
				{@const monthlyChamp = [...streaks].sort((a, b) => b.longest_monthly_streak - a.longest_monthly_streak)[0]}
				{@const mostActive = [...streaks].sort((a, b) => b.total_entries - a.total_entries)[0]}
				{@const trend = trendData[metric.name] || []}
				{@const maxVal = Math.max(...trend.map(t => t.total), 1)}
				{@const hasAnyEntries = streaks.some(s => s.total_entries > 0)}
				
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-colors duration-200">
					<div class="bg-orange-50 dark:bg-orange-900/30 px-4 py-3 border-b dark:border-gray-700 flex items-center gap-2">
						<span class="text-xl">{metric.emoji}</span>
						<h3 class="font-semibold text-orange-800 dark:text-orange-300">{metric.name} Streaks & Records</h3>
					</div>
					
					{#if !hasAnyEntries}
						<div class="p-6 text-center">
							<div class="text-4xl mb-3">🚀</div>
							<div class="text-gray-600 dark:text-gray-300 font-medium">No {metric.name.toLowerCase()} yet!</div>
							<div class="text-sm text-gray-400 dark:text-gray-500">Start logging to build your streaks</div>
						</div>
					{:else}
						{@const totalEntries = streaks.reduce((sum, s) => sum + s.total_entries, 0)}
						{@const hasRecords = (dailyChamp?.longest_daily_streak || 0) > 1 || (weeklyChamp?.longest_weekly_streak || 0) > 1 || (monthlyChamp?.longest_monthly_streak || 0) > 1}
						
						<!-- Current Activity Summary (early year) -->
						{#if !hasRecords}
							<div class="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-b dark:border-gray-700">
								<div class="flex items-center justify-between">
									<div>
										<h4 class="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-1">📊 Getting Started</h4>
										<div class="text-xs text-gray-500 dark:text-gray-400">
											{totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} logged so far
										</div>
									</div>
									<div class="text-right">
										<div class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{totalEntries}</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">total</div>
									</div>
								</div>
								<div class="mt-3 p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg text-xs text-gray-600 dark:text-gray-400">
									💡 Log on consecutive days to build daily streaks, or log weekly to build weekly streaks!
								</div>
							</div>
						{:else}
							<!-- Record Holders -->
							<div class="p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-b dark:border-gray-700">
								<h4 class="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-3">🏆 Records</h4>
								<div class="grid grid-cols-2 gap-3">
								<!-- Longest Daily Streak -->
								{#if dailyChamp && dailyChamp.longest_daily_streak > 1}
									<div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3">
										<div class="text-xs text-gray-500 dark:text-gray-400 mb-1">🔥 Longest Daily</div>
										<div class="flex items-center gap-2">
											<span class="text-lg">{dailyChamp.person_emoji}</span>
											<div>
												<span class="font-bold text-orange-600 dark:text-orange-400">{dailyChamp.longest_daily_streak} days</span>
												{#if dailyChamp.longest_daily_streak_start && dailyChamp.longest_daily_streak_end}
													<div class="text-xs text-gray-400">
														{dailyChamp.longest_daily_streak_start} → {dailyChamp.longest_daily_streak_end}
													</div>
												{/if}
											</div>
										</div>
									</div>
								{/if}
								
								<!-- Longest Weekly Streak -->
								{#if weeklyChamp && weeklyChamp.longest_weekly_streak > 1}
									<div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3">
										<div class="text-xs text-gray-500 dark:text-gray-400 mb-1">📅 Longest Weekly</div>
										<div class="flex items-center gap-2">
											<span class="text-lg">{weeklyChamp.person_emoji}</span>
											<div>
												<span class="font-bold text-blue-600 dark:text-blue-400">{weeklyChamp.longest_weekly_streak} weeks</span>
												{#if weeklyChamp.longest_weekly_streak_start && weeklyChamp.longest_weekly_streak_end}
													<div class="text-xs text-gray-400">
														{weeklyChamp.longest_weekly_streak_start} → {weeklyChamp.longest_weekly_streak_end}
													</div>
												{/if}
											</div>
										</div>
									</div>
								{/if}
								
								<!-- Longest Monthly Streak -->
								{#if monthlyChamp && monthlyChamp.longest_monthly_streak > 1}
									<div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3">
										<div class="text-xs text-gray-500 dark:text-gray-400 mb-1">📆 Longest Monthly</div>
										<div class="flex items-center gap-2">
											<span class="text-lg">{monthlyChamp.person_emoji}</span>
											<span class="font-bold text-purple-600 dark:text-purple-400">{monthlyChamp.longest_monthly_streak} months</span>
										</div>
									</div>
								{/if}
								
								<!-- Most Active -->
								{#if mostActive && mostActive.total_entries > 0}
									<div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3">
										<div class="text-xs text-gray-500 dark:text-gray-400 mb-1">⭐ Most Active</div>
										<div class="flex items-center gap-2">
											<span class="text-lg">{mostActive.person_emoji}</span>
											<div>
												<span class="font-bold text-green-600 dark:text-green-400">{mostActive.total_entries} entries</span>
												<div class="text-xs text-gray-400 dark:text-gray-500">{mostActive.entries_per_week_avg}/week avg</div>
											</div>
										</div>
									</div>
								{/if}
							</div>
						</div>
						{/if}
						
						<!-- Individual Stats -->
						<div class="divide-y dark:divide-gray-700">
							{#each streaks.sort((a, b) => b.total_entries - a.total_entries) as streak}
								{#if streak.total_entries > 0}
									<div class="p-4">
										<div class="flex items-start gap-3">
											<span class="text-2xl">{streak.person_emoji}</span>
											<div class="flex-1 min-w-0">
												<div class="font-medium text-gray-800 dark:text-white">{streak.person_name}</div>
												<div class="text-xs text-gray-400">
													{#if streak.first_entry}
														First: {streak.first_entry} • Last: {streak.last_entry}
													{/if}
												</div>
												
												<!-- Streak badges -->
												<div class="flex flex-wrap gap-2 mt-2">
													<!-- Current Streaks -->
													{#if streak.current_daily_streak > 1}
														<span class="inline-flex items-center gap-1 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-xs px-2 py-1 rounded-full">
															🔥 {streak.current_daily_streak} days now
														</span>
													{/if}
													{#if streak.current_weekly_streak > 1}
														<span class="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-full">
															📅 {streak.current_weekly_streak} weeks now
														</span>
													{/if}
													{#if streak.current_monthly_streak > 1}
														<span class="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs px-2 py-1 rounded-full">
															📆 {streak.current_monthly_streak} months now
														</span>
													{/if}
													
													<!-- Best Records -->
													{#if streak.longest_daily_streak > 1 && streak.longest_daily_streak !== streak.current_daily_streak}
														<span class="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-1 rounded-full">
															Best: {streak.longest_daily_streak}d
														</span>
													{/if}
													{#if streak.longest_weekly_streak > 1 && streak.longest_weekly_streak !== streak.current_weekly_streak}
														<span class="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-1 rounded-full">
															Best: {streak.longest_weekly_streak}w
														</span>
													{/if}
												</div>
												
												<!-- Fun facts -->
												<div class="flex flex-wrap gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
													{#if streak.busiest_day}
														<span>📌 Loves {streak.busiest_day}s</span>
													{/if}
													{#if streak.busiest_month}
														<span>🗓️ Best in {streak.busiest_month}</span>
													{/if}
													<span>📊 {streak.entries_per_week_avg}/week</span>
												</div>
											</div>
											<div class="text-right shrink-0">
												<div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{streak.total_entries}</div>
												<div class="text-xs text-gray-400">total</div>
											</div>
										</div>
									</div>
								{/if}
							{/each}
							
							<!-- People with no entries -->
							{#each [streaks.filter(s => s.total_entries === 0)] as noEntries}
								{#if noEntries.length > 0}
									<div class="p-4 bg-gray-50 dark:bg-gray-700/50">
										<div class="text-sm text-gray-400">No entries yet:</div>
										<div class="flex gap-2 mt-1">
											{#each noEntries as streak}
												<span class="text-lg" title={streak.person_name}>{streak.person_emoji}</span>
											{/each}
										</div>
									</div>
								{/if}
							{/each}
						</div>
						
						<!-- Monthly Trend Graph -->
						{#if trend.length > 0}
							<div class="border-t dark:border-gray-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900/50 dark:to-gray-800/30 p-4">
								<div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center justify-between">
									<span class="flex items-center gap-2">
										<span>📊</span> Monthly Activity
									</span>
									<span class="text-xs text-gray-400">
										{trend.length} {trend.length === 1 ? 'month' : 'months'}
									</span>
								</div>
								<div class="flex items-end gap-2 sm:gap-3 h-28 px-2">
									{#each trend as point, idx}
										{@const barHeight = Math.max(10, (point.total / maxVal) * 100)}
										{@const isLast = idx === trend.length - 1}
										{@const isBest = point.total === maxVal && maxVal > 0}
										<div class="flex-1 flex flex-col items-center gap-1 group relative">
											<div class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
												{point.total}
											</div>
											<div 
												class="w-full rounded-lg transition-all duration-500 hover:scale-105 relative overflow-hidden shadow-sm {isBest ? 'ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-gray-800' : ''}"
												style="height: {barHeight}%; min-height: 8px; background: linear-gradient(to top, {isLast ? '#f97316, #fb923c' : isBest ? '#f59e0b, #fbbf24' : '#fdba74, #fed7aa'})"
											>
												{#if isBest}
													<div class="absolute -top-5 left-1/2 transform -translate-x-1/2 text-xs">
														👑
													</div>
												{/if}
											</div>
											<div class="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">
												{formatMonth(point.month).slice(0, 3)}
											</div>
											<div class="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
												<div class="font-semibold">{formatMonth(point.month)}</div>
												<div class="text-gray-300">{point.total} entries</div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{:else}
							<div class="border-t dark:border-gray-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900/50 dark:to-gray-800/30 p-4 text-center">
								<div class="text-gray-400 dark:text-gray-500 text-sm flex flex-col items-center gap-2">
									<span class="text-2xl opacity-50">📊</span>
									<span>Monthly trend chart will appear after the first month</span>
								</div>
							</div>
						{/if}
					{/if}
				</div>
			{/each}
			
			<div class="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-xl p-4 text-orange-800 dark:text-orange-200 text-sm">
				<strong>💡 Streak Types:</strong>
				<ul class="mt-2 space-y-1 text-xs">
					<li>🔥 <strong>Daily:</strong> Consecutive days with at least one entry</li>
					<li>📅 <strong>Weekly:</strong> Consecutive weeks with at least one entry</li>
					<li>📆 <strong>Monthly:</strong> Consecutive months with at least one entry</li>
				</ul>
			</div>
		{:else if activeTab === 'calendar'}
			<!-- Calendar Heatmap -->
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-lg font-bold text-gray-800 dark:text-white">📆 Activity Calendar</h2>
					<select
						bind:value={selectedCalendarPerson}
						class="px-3 py-2 border dark:border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white dark:bg-gray-700 dark:text-white"
					>
						<option value={null}>All People</option>
						{#each data.people || [] as person}
							<option value={person.id}>{person.emoji || '👤'} {person.name}</option>
						{/each}
					</select>
				</div>
				
				<!-- Month labels -->
				<div class="mb-1 ml-6 sm:ml-10">
					<div class="flex text-[8px] sm:text-xs text-gray-500 dark:text-gray-400 relative" style="min-width: fit-content;">
						{#each monthLabels as label}
							<div 
								class="absolute" 
								style="left: calc({label.weekIndex} * (100% / {calendarData.weeks.length}))"
							>
								{label.month}
							</div>
						{/each}
						<!-- Spacer to ensure container has proper width -->
						<div class="w-full h-4"></div>
					</div>
				</div>
				
				<!-- Heatmap grid -->
				<div class="flex gap-[2px]">
					<!-- Day of week labels -->
					<div class="flex flex-col gap-[1px] sm:gap-[2px] text-[8px] sm:text-[10px] text-gray-500 dark:text-gray-400 pr-1 flex-shrink-0">
						<div class="h-[8px] sm:h-[10px] flex items-center">M</div>
						<div class="h-[8px] sm:h-[10px] flex items-center">T</div>
						<div class="h-[8px] sm:h-[10px] flex items-center">W</div>
						<div class="h-[8px] sm:h-[10px] flex items-center">T</div>
						<div class="h-[8px] sm:h-[10px] flex items-center">F</div>
						<div class="h-[8px] sm:h-[10px] flex items-center">S</div>
						<div class="h-[8px] sm:h-[10px] flex items-center">S</div>
					</div>
					
					<!-- Calendar grid -->
					<div class="flex-1 flex gap-[1px] sm:gap-[2px]">
						{#each calendarData.weeks as week}
							<div class="flex flex-col gap-[1px] sm:gap-[2px] flex-1">
								{#each week as day}
									{#if day}
										{@const month = parseInt(day.date.split('-')[1])}
										{@const isOddMonth = month % 2 === 1}
										<div 
											class="aspect-square w-full max-w-[10px] sm:max-w-[12px] rounded-[2px] {getHeatmapColor(day.count, calendarData.maxCount, isOddMonth)} cursor-pointer hover:ring-1 hover:ring-indigo-400"
											title="{formatDateForTooltip(day.date)}: {day.count} {day.count === 1 ? 'entry' : 'entries'}"
										></div>
									{:else}
										<div class="aspect-square w-full max-w-[10px] sm:max-w-[12px]"></div>
									{/if}
								{/each}
							</div>
						{/each}
					</div>
				</div>
				
				<!-- Legend -->
				<div class="flex items-center justify-end gap-1 sm:gap-2 mt-4 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
					<span>Less</span>
					<div class="w-[8px] h-[8px] sm:w-[12px] sm:h-[12px] rounded-[2px] bg-gray-200 dark:bg-gray-600"></div>
					<div class="w-[8px] h-[8px] sm:w-[12px] sm:h-[12px] rounded-[2px] bg-green-200 dark:bg-green-900"></div>
					<div class="w-[8px] h-[8px] sm:w-[12px] sm:h-[12px] rounded-[2px] bg-green-400 dark:bg-green-700"></div>
					<div class="w-[8px] h-[8px] sm:w-[12px] sm:h-[12px] rounded-[2px] bg-green-500 dark:bg-green-500"></div>
					<div class="w-[8px] h-[8px] sm:w-[12px] sm:h-[12px] rounded-[2px] bg-green-600 dark:bg-green-400"></div>
					<span>More</span>
				</div>
				
				<!-- Stats summary -->
				<div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-center">
					<div>
						<div class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">{calendarData.days.filter(d => d.count > 0).length}</div>
						<div class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Active Days</div>
					</div>
					<div>
						<div class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">{calendarData.days.reduce((sum, d) => sum + d.count, 0)}</div>
						<div class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Total Entries</div>
					</div>
					<div>
						<div class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">{calendarData.maxCount}</div>
						<div class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Best Day</div>
					</div>
				</div>
			</div>

		{:else if activeTab === 'insights'}
			<!-- Insights Tab -->
			<div class="space-y-6">
				<!-- Day of Week Analysis -->
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors duration-200">
					<h3 class="font-semibold text-gray-800 dark:text-white mb-4">📊 Day of Week Insights</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">When do entries happen most frequently?</p>
					
					{#if data.dayOfWeekStats && data.dayOfWeekStats.length > 0}
						{@const maxDayCount = Math.max(...data.dayOfWeekStats.map(d => d.count), 1)}
						{@const busiestDay = data.dayOfWeekStats.reduce((a, b) => a.count > b.count ? a : b)}
						
						<div class="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
							<span class="text-indigo-800 dark:text-indigo-200">
								🏆 <strong>{busiestDay.day}</strong> is the most active day with <strong>{busiestDay.count}</strong> entries ({busiestDay.percentage}%)
							</span>
						</div>
						
						<div class="space-y-2">
							{#each data.dayOfWeekStats as day}
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
						<div class="text-center text-gray-500 dark:text-gray-400 py-8">
							No data available yet
						</div>
					{/if}
				</div>

				<!-- Consistency Scores -->
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors duration-200">
					<h3 class="font-semibold text-gray-800 dark:text-white mb-4">🎯 Consistency Scores</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">How regularly are entries being logged?</p>
					
					{#if data.consistencyScores && data.consistencyScores.length > 0}
						<div class="space-y-4">
							{#each data.consistencyScores as score}
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
						<div class="text-center text-gray-500 dark:text-gray-400 py-8">
							No data available yet
						</div>
					{/if}
				</div>

				<!-- Personal Bests -->
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors duration-200">
					<h3 class="font-semibold text-gray-800 dark:text-white mb-4">🏅 Personal Bests</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Individual achievements and records</p>
					
					{#if data.personalBests && Object.keys(data.personalBests).length > 0}
						<div class="space-y-4">
							{#each statsGrid as person}
								{@const bests = data.personalBests[person.personId] || []}
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
						<div class="text-center text-gray-500 dark:text-gray-400 py-8">
							No personal bests recorded yet
						</div>
					{/if}
				</div>
			</div>

		{:else if activeTab === 'compare'}
			<!-- Compare/Rivalry Mode -->
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors duration-200">
				<h3 class="font-semibold text-gray-800 dark:text-white mb-4">⚔️ Head to Head Comparison</h3>
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Select two people to compare their stats</p>
				
				<div class="grid grid-cols-2 gap-4 mb-6">
					<div>
						<label for="challenger1" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Challenger 1</label>
						<select
							id="challenger1"
							bind:value={comparePersons[0]}
							class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
						>
							<option value={null}>Select person...</option>
							{#each data.people || [] as person}
								<option value={person.id} disabled={person.id === comparePersons[1]}>{person.emoji} {person.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="challenger2" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Challenger 2</label>
						<select
							id="challenger2"
							bind:value={comparePersons[1]}
							class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
						>
							<option value={null}>Select person...</option>
							{#each data.people || [] as person}
								<option value={person.id} disabled={person.id === comparePersons[0]}>{person.emoji} {person.name}</option>
							{/each}
						</select>
					</div>
				</div>
				
				{#if comparisonData}
					<!-- Score header -->
					<div class="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl p-4 mb-6 text-white">
						<div class="grid grid-cols-3 items-center text-center">
							<div>
								<div class="text-3xl mb-1">{comparisonData.person1.emoji}</div>
								<div class="font-medium">{comparisonData.person1.name}</div>
								<div class="text-4xl font-bold mt-2">{comparisonData.wins1}</div>
								<div class="text-sm opacity-80">wins</div>
							</div>
							<div>
								<div class="text-2xl font-bold">VS</div>
								<div class="text-sm opacity-80 mt-2">Total entries</div>
								<div class="text-lg">{comparisonData.person1.total} - {comparisonData.person2.total}</div>
							</div>
							<div>
								<div class="text-3xl mb-1">{comparisonData.person2.emoji}</div>
								<div class="font-medium">{comparisonData.person2.name}</div>
								<div class="text-4xl font-bold mt-2">{comparisonData.wins2}</div>
								<div class="text-sm opacity-80">wins</div>
							</div>
						</div>
					</div>
					
					<!-- Metric breakdown -->
					<div class="space-y-3">
						{#each comparisonData.comparison as item}
							{@const total = item.person1 + item.person2}
							{@const p1Width = total > 0 ? (item.person1 / total) * 100 : 50}
							<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
								<div class="flex items-center justify-between mb-2">
									<span class="text-sm font-medium text-gray-700 dark:text-gray-300">{item.emoji} {item.metric}</span>
									{#if item.winner === 1}
										<span class="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full">👑 {comparisonData.person1.name} leads</span>
									{:else if item.winner === 2}
										<span class="text-xs bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 px-2 py-1 rounded-full">👑 {comparisonData.person2.name} leads</span>
									{:else}
										<span class="text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">🤝 Tied</span>
									{/if}
								</div>
								<div class="flex items-center gap-2">
									<div class="font-bold text-indigo-600 dark:text-indigo-400 w-12 text-right">{item.person1}</div>
									<div class="flex-1 h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden flex">
										<div class="h-full bg-indigo-500" style="width: {p1Width}%"></div>
										<div class="h-full bg-pink-500" style="width: {100 - p1Width}%"></div>
									</div>
									<div class="font-bold text-pink-600 dark:text-pink-400 w-12">{item.person2}</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-center py-12 text-gray-500 dark:text-gray-400">
						<div class="text-4xl mb-3">⚔️</div>
						<p>Select two people above to start the comparison</p>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	
	@keyframes progressGrow {
		from {
			width: 0%;
		}
	}
	
	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	
	@keyframes bounce-in {
		0% {
			opacity: 0;
			transform: scale(0.3);
		}
		50% {
			transform: scale(1.05);
		}
		70% {
			transform: scale(0.9);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
	
	.animate-fade-in {
		animation: fade-in 0.3s ease-out;
	}
	
	.animate-bounce-in {
		animation: bounce-in 0.5s ease-out;
	}
	
	@media print {
		.print\\:hidden {
			display: none !important;
		}
		
		.print-mode {
			background: white !important;
		}
	}
</style>
