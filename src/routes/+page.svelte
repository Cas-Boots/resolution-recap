<script lang="ts">
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { 
		initOfflineSupport, 
		createEntryWithOfflineFallback, 
		pendingEntriesCount, 
		isOnline, 
		syncPendingEntries 
	} from '$lib/stores/offlineQueue';
	import { locale, t } from '$lib/stores/locale';
	import type { Translations, Locale } from '$lib/i18n';
	import { translateMetric } from '$lib/i18n';

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

	// Predefined sport activity types - reactive for translations
	const SPORT_ACTIVITIES = $derived([
		{ value: 'running', label: `🏃 ${translations?.sports.running ?? 'Running'}` },
		{ value: 'cycling', label: `🚴 ${translations?.sports.cycling ?? 'Cycling'}` },
		{ value: 'swimming', label: `🏊 ${translations?.sports.swimming ?? 'Swimming'}` },
		{ value: 'gym', label: `🏋️ ${translations?.sports.gym ?? 'Gym'}` },
		{ value: 'yoga', label: `🧘 ${translations?.sports.yoga ?? 'Yoga'}` },
		{ value: 'hiking', label: `🥾 ${translations?.sports.hiking ?? 'Hiking'}` },
		{ value: 'tennis', label: `🎾 ${translations?.sports.tennis ?? 'Tennis'}` },
		{ value: 'padel', label: `🎾 ${translations?.sports.padel ?? 'Padel'}` },
		{ value: 'football', label: `⚽ ${translations?.sports.football ?? 'Football'}` },
		{ value: 'basketball', label: `🏀 ${translations?.sports.basketball ?? 'Basketball'}` },
		{ value: 'hockey', label: `🏑 ${translations?.sports.hockey ?? 'Hockey'}` },
		{ value: 'volleyball', label: `🏐 ${translations?.sports.volleyball ?? 'Volleyball'}` },
		{ value: 'climbing', label: `🧗 ${translations?.sports.climbing ?? 'Climbing'}` },
		{ value: 'bouldering', label: `🧗 ${translations?.sports.bouldering ?? 'Bouldering'}` },
		{ value: 'skiing', label: `⛷️ ${translations?.sports.skiing ?? 'Skiing'}` },
		{ value: 'skating', label: `⛸️ ${translations?.sports.skating ?? 'Skating'}` },
		{ value: 'boxing', label: `🥊 ${translations?.sports.boxing ?? 'Boxing'}` },
		{ value: 'martial-arts', label: `🥋 ${translations?.sports.martialArts ?? 'Martial Arts'}` },
		{ value: 'dance', label: `💃 ${translations?.sports.dance ?? 'Dance'}` },
		{ value: 'other', label: `🏅 ${translations?.sports.other ?? 'Other'}` }
	]);

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Quick action state
	let pendingAction = $state<{ personId: number; personName: string; personEmoji: string; metricId: number; metricName: string } | null>(null);
	let selectedSportTag = $state<string | null>(null);
	let duplicateWarning = $state<{ personName: string; metricName: string; tags?: string } | null>(null);
	let loading = $state(false);
	let successMessage = $state('');
	let newAchievements = $state<{ name: string; emoji: string }[]>([]);
	let lastEntryId = $state<number | null>(null);
	let offlinePending = $state(0);
	let online = $state(true);

	// Optimistic UI state
	let optimisticUpdates = $state<Map<string, number>>(new Map());

	// Pull-to-refresh state
	let pullStartY = $state(0);
	let pullDistance = $state(0);
	let isPulling = $state(false);
	let isRefreshing = $state(false);
	const PULL_THRESHOLD = 80;

	// Swipe gesture state
	let swipeStartX = $state(0);
	let swipeStartY = $state(0);
	let swipeCurrentX = $state(0);
	let swipeActiveRow = $state<{ personId: number; personName: string; personEmoji: string } | null>(null);
	const SWIPE_THRESHOLD = 80;

	// Expandable person details state
	let expandedPersonId = $state<number | null>(null);
	let personHistory = $state<Map<number, { person_name: string; metric_name: string; entry_date: string; notes?: string }[]>>(new Map());

	// Time period filter state
	let selectedPeriod = $state<'today' | 'week' | 'month' | 'all'>('all');
	
	// View mode state - supports per-metric leaderboards
	let viewMode = $state<'default' | string>('default');
	let selectedLeaderboardMetric = $state<string | null>(null);
	
	// Confetti state
	let showConfetti = $state(false);
	let confettiMessage = $state('');
	
	// Animation tracking for counter changes
	let animatingCounters = $state<Set<string>>(new Set());

	// Check if pending action is for sporting
	let isSportingAction = $derived(() => {
		return pendingAction?.metricName?.toLowerCase() === 'sporting';
	});

	// Sort metrics with Sporting first, then by name
	const sortedMetrics = $derived.by(() => {
		const metrics = data.metrics || [];
		return [...metrics].sort((a, b) => {
			// Sporting first
			if (a.name.toLowerCase() === 'sporting') return -1;
			if (b.name.toLowerCase() === 'sporting') return 1;
			// Then alphabetical
			return a.name.localeCompare(b.name);
		});
	});

	// Subscribe to offline stores
	onMount(() => {
		initOfflineSupport();
		
		const unsubPending = pendingEntriesCount.subscribe(v => offlinePending = v);
		const unsubOnline = isOnline.subscribe(v => online = v);
		
		// Keyboard shortcuts handler
		function handleKeyDown(e: KeyboardEvent) {
			// Ignore if user is typing in an input
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
			if (pendingAction) return; // Don't trigger if modal is open
			
			const people = data.people || [];
			const metrics = data.metrics || [];
			
			// Number keys 1-9 for person selection + letter for metric
			if (e.key >= '1' && e.key <= '9') {
				const personIndex = parseInt(e.key) - 1;
				if (personIndex < people.length) {
					const person = people[personIndex];
					// Wait for next key for metric
					const metricHandler = (e2: KeyboardEvent) => {
						const key = e2.key.toLowerCase();
						let metric = null;
						
						// S for sporting, C for cake, or first letter of metric
						for (const m of metrics) {
							if (m.name.toLowerCase().startsWith(key)) {
								metric = m;
								break;
							}
						}
						
						if (metric) {
							showConfirmation(person.id, person.name, person.emoji || '👤', metric.id, metric.name);
						}
						
						document.removeEventListener('keydown', metricHandler);
					};
					
					document.addEventListener('keydown', metricHandler, { once: true });
					// Auto-remove after 2 seconds
					setTimeout(() => document.removeEventListener('keydown', metricHandler), 2000);
				}
			}
			
			// L for leaderboard toggle (cycles through metrics)
			if (e.key === 'l' || e.key === 'L') {
				const metricsList = data.metrics?.map((m: { name: string }) => m.name) || [];
				if (viewMode === 'default') {
					// Switch to first metric leaderboard
					if (metricsList.length > 0) {
						viewMode = 'leaderboard';
						selectedLeaderboardMetric = metricsList[0];
					}
				} else if (viewMode === 'leaderboard' && selectedLeaderboardMetric) {
					// Cycle through metrics or back to default
					const currentIndex = metricsList.indexOf(selectedLeaderboardMetric);
					if (currentIndex < metricsList.length - 1) {
						selectedLeaderboardMetric = metricsList[currentIndex + 1];
					} else {
						viewMode = 'default';
						selectedLeaderboardMetric = null;
					}
				}
			}
			
			// R for refresh
			if (e.key === 'r' || e.key === 'R') {
				invalidateAll();
			}
		}
		
		document.addEventListener('keydown', handleKeyDown);
		
		return () => {
			unsubPending();
			unsubOnline();
			document.removeEventListener('keydown', handleKeyDown);
		};
	});

	// Helper to get optimistic count
	function getOptimisticCount(personId: number, metricName: string, actualCount: number): number {
		const key = `${personId}-${metricName}`;
		const optimistic = optimisticUpdates.get(key) || 0;
		return actualCount + optimistic;
	}

	// Apply optimistic update
	function applyOptimisticUpdate(personId: number, metricName: string) {
		const key = `${personId}-${metricName}`;
		const newMap = new Map(optimisticUpdates);
		newMap.set(key, (newMap.get(key) || 0) + 1);
		optimisticUpdates = newMap;
	}

	// Clear optimistic update after server confirms
	function clearOptimisticUpdate(personId: number, metricName: string) {
		const key = `${personId}-${metricName}`;
		const newMap = new Map(optimisticUpdates);
		newMap.delete(key);
		optimisticUpdates = newMap;
	}

	// Revert optimistic update on error
	function revertOptimisticUpdate(personId: number, metricName: string) {
		const key = `${personId}-${metricName}`;
		const newMap = new Map(optimisticUpdates);
		const current = newMap.get(key) || 0;
		if (current <= 1) {
			newMap.delete(key);
		} else {
			newMap.set(key, current - 1);
		}
		optimisticUpdates = newMap;
	}

	// Pull-to-refresh handlers
	function handleTouchStart(e: TouchEvent) {
		if (window.scrollY === 0 && !isRefreshing) {
			pullStartY = e.touches[0].clientY;
			isPulling = true;
		}
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isPulling || isRefreshing) return;
		const currentY = e.touches[0].clientY;
		pullDistance = Math.max(0, Math.min((currentY - pullStartY) * 0.5, 120));
		if (pullDistance > 10) {
			e.preventDefault();
		}
	}

	async function handleTouchEnd() {
		if (!isPulling) return;
		isPulling = false;
		
		if (pullDistance >= PULL_THRESHOLD) {
			isRefreshing = true;
			await invalidateAll();
			isRefreshing = false;
		}
		pullDistance = 0;
	}

	// Swipe gesture handlers
	function handleRowTouchStart(e: TouchEvent, person: { id: number; name: string; emoji?: string }) {
		swipeStartX = e.touches[0].clientX;
		swipeStartY = e.touches[0].clientY;
		swipeCurrentX = swipeStartX;
		swipeActiveRow = { personId: person.id, personName: person.name, personEmoji: person.emoji || '👤' };
	}

	function handleRowTouchMove(e: TouchEvent) {
		if (!swipeActiveRow) return;
		const currentX = e.touches[0].clientX;
		const currentY = e.touches[0].clientY;
		const deltaX = currentX - swipeStartX;
		const deltaY = Math.abs(currentY - swipeStartY);
		
		// Only track horizontal swipes
		if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 10) {
			e.preventDefault();
			swipeCurrentX = currentX;
		}
	}

	function handleRowTouchEnd() {
		if (!swipeActiveRow) return;
		const deltaX = swipeCurrentX - swipeStartX;
		const metrics = data.metrics || [];
		
		// Swipe right = first metric, swipe left = second metric
		if (deltaX >= SWIPE_THRESHOLD && metrics[0]) {
			showConfirmation(
				swipeActiveRow.personId,
				swipeActiveRow.personName,
				swipeActiveRow.personEmoji,
				metrics[0].id,
				metrics[0].name
			);
		} else if (deltaX <= -SWIPE_THRESHOLD && metrics[1]) {
			showConfirmation(
				swipeActiveRow.personId,
				swipeActiveRow.personName,
				swipeActiveRow.personEmoji,
				metrics[1].id,
				metrics[1].name
			);
		}
		
		swipeActiveRow = null;
		swipeCurrentX = swipeStartX;
	}

	// Create emoji lookup from people
	const personEmojis = $derived(() => {
		const map = new Map<number, string>();
		for (const person of data.people || []) {
			map.set(person.id, person.emoji || '👤');
		}
		return map;
	});

	// Group stats by person
	interface StatRow {
		personName: string;
		personId: number;
		personEmoji: string;
		metrics: Record<string, { count: number; metricId: number }>;
	}

	const statsGrid = $derived.by(() => {
		if (!data.stats || !data.metrics) return [];
		
		const grouped = new Map<string, { personId: number; personEmoji: string; metrics: Record<string, { count: number; metricId: number }> }>();
		
		for (const stat of data.stats) {
			if (!grouped.has(stat.person_name)) {
				const emoji = personEmojis().get(stat.person_id) || '👤';
				grouped.set(stat.person_name, { personId: stat.person_id, personEmoji: emoji, metrics: {} });
			}
			grouped.get(stat.person_name)!.metrics[stat.metric_name] = { 
				count: stat.count, 
				metricId: stat.metric_id 
			};
		}

		return Array.from(grouped.entries()).map(([personName, data]) => ({
			personName,
			personId: data.personId,
			personEmoji: data.personEmoji,
			metrics: data.metrics
		}));
	});

	const metricNames = $derived(data.metrics?.map((m: { name: string }) => m.name) || []);

	// Build sparkline data lookup: Map<"personId-metricId", number[]>
	const sparklineMap = $derived.by(() => {
		const map = new Map<string, number[]>();
		if (!data.sparklineData) return map;
		
		// Generate last 7 days
		const days: string[] = [];
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			days.push(d.toISOString().split('T')[0]);
		}
		
		// Initialize all person-metric combinations with zeros
		for (const person of data.people || []) {
			for (const metric of data.metrics || []) {
				map.set(`${person.id}-${metric.id}`, new Array(7).fill(0));
			}
		}
		
		// Fill in actual counts
		for (const entry of data.sparklineData) {
			const key = `${entry.person_id}-${entry.metric_id}`;
			const arr = map.get(key);
			if (arr) {
				const dayIndex = days.indexOf(entry.entry_date);
				if (dayIndex >= 0) {
					arr[dayIndex] = entry.count;
				}
			}
		}
		
		return map;
	});

	// Build weekly comparison lookup: Map<"personId-metricId", { thisWeek: number, lastWeek: number, diff: number }>
	const weeklyComparisonMap = $derived.by(() => {
		const map = new Map<string, { thisWeek: number; lastWeek: number; diff: number }>();
		if (!data.weeklyComparison) return map;
		
		for (const item of data.weeklyComparison) {
			const key = `${item.person_id}-${item.metric_id}`;
			map.set(key, {
				thisWeek: item.this_week,
				lastWeek: item.last_week,
				diff: item.this_week - item.last_week
			});
		}
		
		return map;
	});

	// Today's activity summary
	const todaySummary = $derived.by(() => {
		if (!data.todayEntries || data.todayEntries.length === 0) return null;
		
		const byPerson = new Map<string, { emoji: string; metrics: string[] }>();
		for (const entry of data.todayEntries) {
			const name = entry.person_name;
			if (!byPerson.has(name)) {
				byPerson.set(name, { emoji: entry.person_emoji || '👤', metrics: [] });
			}
			byPerson.get(name)!.metrics.push(entry.metric_name);
		}
		
		return {
			totalCount: data.todayEntries.length,
			byPerson: Array.from(byPerson.entries()).map(([name, data]) => ({
				name,
				emoji: data.emoji,
				metrics: data.metrics
			}))
		};
	});

	// Streaks lookup: Map<"personId-metricId", { current: number, longest: number }>
	const streaksMap = $derived.by(() => {
		const map = new Map<string, { current: number; longest: number }>();
		if (!data.streaks) return map;
		
		for (const streak of data.streaks) {
			const key = `${streak.person_id}-${streak.metric_id}`;
			map.set(key, {
				current: streak.current_streak,
				longest: streak.longest_streak
			});
		}
		
		return map;
	});

	// Goals lookup: Map<"personId-metricId", { target: number, current: number }>
	const goalsMap = $derived.by(() => {
		const map = new Map<string, { target: number; current: number; percentage: number }>();
		if (!data.goals) return map;
		
		for (const goal of data.goals) {
			const key = `${goal.person_id}-${goal.metric_id}`;
			const percentage = Math.min(100, Math.round((goal.current / goal.target) * 100));
			map.set(key, {
				target: goal.target,
				current: goal.current,
				percentage
			});
		}
		
		return map;
	});

	// Leaderboard data (sorted by total count across all metrics)
	const leaderboard = $derived.by(() => {
		if (!statsGrid || statsGrid.length === 0) return [];
		
		return [...statsGrid]
			.map(row => {
				const totalCount = Object.values(row.metrics).reduce((sum, m) => sum + m.count, 0);
				return { ...row, totalCount };
			})
			.sort((a, b) => b.totalCount - a.totalCount);
	});

	// Metric-specific leaderboard (sorted by count for selected metric)
	const metricLeaderboard = $derived.by(() => {
		if (!statsGrid || statsGrid.length === 0 || !selectedLeaderboardMetric) return [];
		
		const metric = selectedLeaderboardMetric;
		return [...statsGrid]
			.map(row => {
				const metricCount = row.metrics[metric]?.count || 0;
				return { ...row, metricCount };
			})
			.sort((a, b) => b.metricCount - a.metricCount);
	});

	// Milestone thresholds for confetti
	const MILESTONES = [10, 25, 50, 75, 100, 150, 200, 250, 500, 1000];

	// Trigger confetti for milestones
	function checkMilestone(personName: string, metricName: string, newCount: number) {
		if (MILESTONES.includes(newCount)) {
			confettiMessage = `🎉 ${personName} hit ${newCount} ${metricName}!`;
			showConfetti = true;
			setTimeout(() => {
				showConfetti = false;
				confettiMessage = '';
			}, 4000);
		}
	}

	// Trigger counter animation
	function animateCounter(personId: number, metricName: string) {
		const key = `${personId}-${metricName}`;
		const newSet = new Set(animatingCounters);
		newSet.add(key);
		animatingCounters = newSet;
		
		setTimeout(() => {
			const updated = new Set(animatingCounters);
			updated.delete(key);
			animatingCounters = updated;
		}, 500);
	}

	async function showConfirmation(personId: number, personName: string, personEmoji: string, metricId: number, metricName: string) {
		// Check for duplicate first
		duplicateWarning = null;
		const today = new Date().toISOString().split('T')[0];
		
		try {
			const res = await fetch(`${base}/api/entries/check-duplicate?personId=${personId}&metricId=${metricId}&entryDate=${today}`);
			if (res.ok) {
				const data = await res.json();
				if (data.isDuplicate && data.existing) {
					duplicateWarning = {
						personName: data.existing.personName,
						metricName: data.existing.metricName,
						tags: data.existing.tags
					};
				}
			}
		} catch {
			// Continue without duplicate check if offline
		}
		
		pendingAction = { personId, personName, personEmoji, metricId, metricName };
	}

	function cancelAction() {
		pendingAction = null;
		selectedSportTag = null;
		duplicateWarning = null;
	}

	async function confirmAction() {
		if (!pendingAction || !data.season) return;

		loading = true;
		
		// Apply optimistic update immediately
		const actionPersonId = pendingAction.personId;
		const actionMetricName = pendingAction.metricName;
		const actionPersonName = pendingAction.personName;
		const actionMetricId = pendingAction.metricId;
		applyOptimisticUpdate(actionPersonId, actionMetricName);
		animateCounter(actionPersonId, actionMetricName);

		// Get current count for milestone check
		const currentCount = statsGrid.find(r => r.personId === actionPersonId)?.metrics[actionMetricName]?.count || 0;
		const newCount = currentCount + 1;

		try {
			const result = await createEntryWithOfflineFallback(
				pendingAction.personId,
				pendingAction.metricId,
				new Date().toISOString().split('T')[0],
				undefined,
				selectedSportTag || undefined
			);

			if (result.success) {
				if (result.offline) {
					// Queued for offline sync
					successMessage = `${pendingAction.personEmoji} +1 ${pendingAction.metricName} saved offline!`;
				} else {
					// Successfully synced
					lastEntryId = (result.data as { id: number })?.id || null;
					
					// Check for new achievements
					const data = result.data as { newAchievements?: { name: string; emoji: string }[] };
					if (data?.newAchievements && data.newAchievements.length > 0) {
						newAchievements = data.newAchievements;
					}
					
					// Check for milestones
					checkMilestone(actionPersonName, actionMetricName, newCount);
					
					successMessage = `${pendingAction.personEmoji} +1 ${pendingAction.metricName} for ${pendingAction.personName}!`;
				}
				
				pendingAction = null;
				selectedSportTag = null;
				duplicateWarning = null;
				
				// Clear optimistic update after server data loads
				await invalidateAll();
				clearOptimisticUpdate(actionPersonId, actionMetricName);
				
				setTimeout(() => {
					successMessage = '';
					newAchievements = [];
				}, 3000);
			} else {
				// Revert on failure
				revertOptimisticUpdate(actionPersonId, actionMetricName);
			}
		} catch {
			// Revert optimistic update on error
			revertOptimisticUpdate(actionPersonId, actionMetricName);
		} finally {
			loading = false;
		}
	}

	async function undoLastEntry() {
		if (!lastEntryId) return;
		
		try {
			const res = await fetch(`${base}/api/entries`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: lastEntryId })
			});
			
			if (res.ok) {
				successMessage = '↩️ Entry undone!';
				lastEntryId = null;
				await invalidateAll();
				
				setTimeout(() => {
					successMessage = '';
				}, 2000);
			}
		} catch {
			// Silently fail
		}
	}

	function getMetricEmoji(metric: string): string {
		const lower = metric.toLowerCase();
		if (lower.includes('sport')) return '🏃';
		if (lower.includes('cake')) return '🍰';
		return '📊';
	}

	function formatTimeAgo(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays === 1) return 'yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	}

	// Toggle expandable person details
	async function togglePersonExpand(personId: number) {
		if (expandedPersonId === personId) {
			expandedPersonId = null;
			return;
		}
		
		expandedPersonId = personId;
		
		// Fetch recent history if not cached
		if (!personHistory.has(personId)) {
			try {
				const res = await fetch(`${base}/api/entries?personId=${personId}&limit=10`);
				if (res.ok) {
					const entries = await res.json();
					const newMap = new Map(personHistory);
					newMap.set(personId, entries);
					personHistory = newMap;
				}
			} catch {
				// Use empty array on error
				const newMap = new Map(personHistory);
				newMap.set(personId, []);
				personHistory = newMap;
			}
		}
	}

	// Generate SVG sparkline path
	function getSparklinePath(values: number[]): string {
		if (!values || values.length === 0) return '';
		const max = Math.max(...values, 1);
		const width = 60;
		const height = 20;
		const step = width / (values.length - 1);
		
		const points = values.map((v, i) => {
			const x = i * step;
			const y = height - (v / max) * height;
			return `${x},${y}`;
		});
		
		return `M${points.join(' L')}`;
	}

	// Get weekly diff indicator
	function getWeeklyDiff(personId: number, metricId: number): { diff: number; thisWeek: number } | null {
		const key = `${personId}-${metricId}`;
		return weeklyComparisonMap.get(key) || null;
	}

	// Get streak for person/metric
	function getStreak(personId: number, metricId: number): { current: number; longest: number } | null {
		const key = `${personId}-${metricId}`;
		return streaksMap.get(key) || null;
	}

	// Get goal progress for person/metric
	function getGoalProgress(personId: number, metricId: number): { target: number; current: number; percentage: number } | null {
		const key = `${personId}-${metricId}`;
		return goalsMap.get(key) || null;
	}
</script>

<style>
	/* Counter animation */
	@keyframes countBounce {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.3); }
	}
	
	.counter-animate {
		animation: countBounce 0.5s ease-out;
	}
	
	/* Confetti animation */
	@keyframes confettiFall {
		0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
		100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
	}
	
	.confetti-piece {
		position: fixed;
		width: 10px;
		height: 10px;
		top: 0;
		animation: confettiFall 3s ease-out forwards;
	}
</style>

<div 
	class="space-y-6"
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
>
	<!-- Confetti overlay -->
	{#if showConfetti}
		<div class="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
			{#each Array(50) as _, i}
				<div 
					class="confetti-piece rounded-sm"
					style="
						left: {Math.random() * 100}%;
						background: {['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe'][i % 8]};
						animation-delay: {Math.random() * 0.5}s;
						animation-duration: {2 + Math.random() * 2}s;
					"
				></div>
			{/each}
			<div class="absolute top-1/4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-4 rounded-2xl shadow-2xl text-xl font-bold animate-bounce">
				{confettiMessage}
			</div>
		</div>
	{/if}

	<!-- Pull-to-refresh indicator -->
	{#if pullDistance > 0 || isRefreshing}
		<div 
			class="fixed top-0 left-0 right-0 flex justify-center z-40 pointer-events-none"
			style="transform: translateY({Math.min(pullDistance, 100)}px); transition: {isPulling ? 'none' : 'transform 0.2s ease-out'}"
		>
			<div class="bg-white dark:bg-gray-800 rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
				{#if isRefreshing}
					<span class="animate-spin">🔄</span>
					<span class="text-sm text-gray-600 dark:text-gray-300">Refreshing...</span>
				{:else if pullDistance >= PULL_THRESHOLD}
					<span>↓</span>
					<span class="text-sm text-gray-600 dark:text-gray-300">Release to refresh</span>
				{:else}
					<span style="transform: rotate({pullDistance * 2}deg)">↓</span>
					<span class="text-sm text-gray-600 dark:text-gray-300">Pull to refresh</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Confirmation Modal -->
	{#if pendingAction}
		<div class="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
			<div class="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full sm:max-w-sm text-center safe-area-bottom">
				<div class="text-4xl sm:text-5xl mb-3 sm:mb-4">{pendingAction.personEmoji}</div>
				<h2 class="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-2">Confirm Entry</h2>
				<p class="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-3 sm:mb-4">
					Add <strong>+1 {pendingAction.metricName}</strong> {getMetricEmoji(pendingAction.metricName)} for <strong>{pendingAction.personName}</strong> today?
				</p>
				
				<!-- Duplicate warning -->
				{#if duplicateWarning}
					<div class="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl text-amber-800 dark:text-amber-200 text-xs sm:text-sm">
						<p class="font-semibold">⚠️ Possible duplicate!</p>
						<p>{duplicateWarning.personName} already has a {duplicateWarning.metricName} entry for today{duplicateWarning.tags ? ` (${duplicateWarning.tags})` : ''}.</p>
					</div>
				{/if}
				
				<!-- Sport activity selection -->
				{#if isSportingAction()}
					<div class="mb-3 sm:mb-4">
						<p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2">What activity?</p>
						<div class="flex flex-wrap gap-1.5 sm:gap-2 justify-center max-h-40 sm:max-h-48 overflow-y-auto">
							{#each SPORT_ACTIVITIES as activity}
								<button
									type="button"
									onclick={() => selectedSportTag = selectedSportTag === activity.value ? null : activity.value}
									class="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors {selectedSportTag === activity.value 
										? 'bg-indigo-600 text-white' 
										: 'bg-gray-100 dark:bg-gray-700 hover:bg-indigo-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'}"
								>
									{activity.label}
								</button>
							{/each}
						</div>
					</div>
				{/if}
				
				<div class="flex gap-2 sm:gap-3">
					<button
						onclick={cancelAction}
						class="flex-1 py-2.5 sm:py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm sm:text-base"
					>
						Cancel
					</button>
					<button
						onclick={confirmAction}
						disabled={loading}
						class="flex-1 py-2.5 sm:py-3 {duplicateWarning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-semibold rounded-xl disabled:opacity-50 transition-colors text-sm sm:text-base"
					>
						{loading ? '...' : duplicateWarning ? 'Add anyway' : 'Confirm'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Offline/Pending indicator -->
	{#if !online || offlinePending > 0}
		<div class="fixed top-4 right-4 z-50 flex flex-col gap-2 items-end">
			{#if !online}
				<div class="bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2">
					📴 Offline Mode
				</div>
			{/if}
			{#if offlinePending > 0}
				<button
					onclick={async () => {
						const result = await syncPendingEntries();
						if (result.synced > 0) {
							successMessage = `✅ Synced ${result.synced} entries!`;
							await invalidateAll();
							setTimeout(() => successMessage = '', 2000);
						}
					}}
					class="bg-indigo-500 text-white px-3 sm:px-4 py-2 rounded-full shadow-lg text-xs sm:text-sm font-medium flex items-center gap-2 hover:bg-indigo-600 transition-colors"
				>
					⏳ {offlinePending} pending {online ? '(tap to sync)' : ''}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Success Toast with Undo -->
	{#if successMessage}
		<div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 w-[calc(100%-2rem)] sm:w-auto max-w-sm sm:max-w-none">
			<div class="bg-green-500 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-lg text-sm sm:text-base font-medium animate-pulse flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
				<span class="flex items-center gap-1">✅ {successMessage}</span>
				{#if lastEntryId}
					<button
						onclick={undoLastEntry}
						class="bg-white/20 hover:bg-white/30 px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm transition-colors whitespace-nowrap"
					>
						↩️ Undo
					</button>
				{/if}
			</div>
			
			<!-- Achievement Unlocked Toast -->
			{#if newAchievements.length > 0}
				<div class="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-lg text-sm sm:text-base font-medium animate-bounce text-center">
					🏆 Achievement{newAchievements.length > 1 ? 's' : ''}: {newAchievements.map(a => `${a.emoji} ${a.name}`).join(', ')}
				</div>
			{/if}
		</div>
	{/if}

	<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div>
				<h1 class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-1">📊 {translations?.dashboard.title ?? 'Dashboard'}</h1>
				{#if data.season}
					<p class="text-sm sm:text-base text-gray-500">{data.season.name}</p>
				{/if}
			</div>
			
			<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
				<!-- View Mode Toggle -->
				<div class="w-full sm:w-auto overflow-x-auto -mx-1 px-1 pb-1 sm:pb-0 scrollbar-hide">
					<div class="inline-flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1 shadow-inner gap-1 min-w-max">
						<button
							onclick={() => { viewMode = 'default'; selectedLeaderboardMetric = null; }}
							class="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 {viewMode === 'default' ? 'bg-white dark:bg-gray-700 shadow-lg text-indigo-600 dark:text-indigo-400 scale-[1.02]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'}"
						>
							<span class="text-base sm:text-lg">📊</span>
							<span>Stats</span>
						</button>
						{#each data.metrics || [] as metric}
							<button
								onclick={() => { viewMode = 'leaderboard'; selectedLeaderboardMetric = metric.name; }}
								class="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 {viewMode === 'leaderboard' && selectedLeaderboardMetric === metric.name ? 'bg-white dark:bg-gray-700 shadow-lg text-amber-600 dark:text-amber-400 scale-[1.02]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'}"
							>
								<span class="text-base sm:text-lg">{getMetricEmoji(metric.name)}</span>
								<span>{getTranslatedMetricName(metric)}</span>
							</button>
						{/each}
					</div>
				</div>
				
				<!-- Time Period Filter -->
				<div class="relative w-full sm:w-auto">
					<select
						bind:value={selectedPeriod}
						class="appearance-none w-full sm:w-auto pl-4 pr-10 py-2.5 bg-white dark:bg-gray-800 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-600 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-all"
					>
						<option value="all">📅  {translations?.dashboard.allTime ?? 'All Time'}</option>
						<option value="month">🗓️  {translations?.dashboard.thisMonth ?? 'This Month'}</option>
						<option value="week">📆  {translations?.dashboard.thisWeek ?? 'This Week'}</option>
						<option value="today">☀️  {translations?.dashboard.today ?? 'Today'}</option>
					</select>
					<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
						</svg>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Keyboard shortcuts hint (desktop only) -->
		<div class="hidden md:flex items-center gap-4 mt-4 pt-4 border-t dark:border-gray-700 text-xs text-gray-400">
			<span>⌨️ Shortcuts:</span>
			<span><kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">1-9</kbd> + <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">S/C</kbd> quick add</span>
			<span><kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">L</kbd> leaderboard</span>
			<span><kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">R</kbd> refresh</span>
		</div>
	</div>

	{#if !data.season}
		<div class="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-yellow-800 dark:text-yellow-200">
			{translations?.dashboard.noActiveSeason ?? 'No active season. Ask an admin to set one up.'}
		</div>
	{:else}
		<!-- TODAY'S ACTIVITY SUMMARY -->
		{#if todaySummary}
			<div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg p-4 sm:p-5 text-white">
				<div class="flex items-center justify-between mb-3 gap-2">
					<h2 class="text-base sm:text-lg font-bold flex items-center gap-2">
						☀️ {translations?.dashboard.todaysActivity ?? "Today's Activity"}
					</h2>
					<span class="bg-white/20 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap">
						{todaySummary.totalCount} {todaySummary.totalCount === 1 ? (translations?.dashboard.entry ?? 'entry') : (translations?.dashboard.entries ?? 'entries')}
					</span>
				</div>
				<div class="flex flex-wrap gap-2 sm:gap-3">
					{#each todaySummary.byPerson as person}
						<div class="bg-white/15 backdrop-blur rounded-xl px-3 sm:px-4 py-2 flex items-center gap-2">
							<span class="text-lg sm:text-xl">{person.emoji}</span>
							<div>
								<div class="font-medium text-xs sm:text-sm">{person.name}</div>
								<div class="text-[10px] sm:text-xs opacity-80">
									{person.metrics.map(m => getMetricEmoji(m)).join(' ')}
									{person.metrics.length}x
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<div class="bg-gradient-to-br from-gray-400 to-gray-500 rounded-2xl shadow-lg p-5 text-white">
				<div class="flex items-center gap-2">
					<span class="text-2xl">☀️</span>
					<div>
						<h2 class="font-bold">{translations?.dashboard.noActivityYet ?? 'No activity yet today'}</h2>
						<p class="text-sm opacity-80">{translations?.dashboard.getStarted ?? 'Use Quick Add below to get started!'}</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- QUICK ACTIONS - Most prominent section -->
		<div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-4 sm:p-6 text-white">
			<h2 class="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex flex-wrap items-center gap-2">
				⚡ {translations?.dashboard.quickAdd ?? 'Quick Add'}
				<span class="text-xs sm:text-sm font-normal opacity-80">— {translations?.dashboard.tapToLog ?? 'tap to log today'}</span>
			</h2>
			
			<div class="space-y-3 sm:space-y-4">
				{#each sortedMetrics as metric}
					<div>
						<div class="text-xs sm:text-sm opacity-80 mb-2 flex items-center gap-1">
							{getMetricEmoji(metric.name)} {getTranslatedMetricName(metric)}
						</div>
						<div class="grid grid-cols-2 xs:flex xs:flex-wrap gap-2">
							{#each data.people || [] as person}
								<button
									onclick={() => showConfirmation(person.id, person.name, person.emoji || '👤', metric.id, metric.name)}
									class="px-3 sm:px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl text-sm sm:text-base font-medium transition-all active:scale-95 border border-white/20 flex items-center justify-center gap-1.5 sm:gap-2"
								>
									<span class="text-base sm:text-lg">{person.emoji || '👤'}</span>
									<span class="truncate">{person.name}</span>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			
			<p class="text-[10px] sm:text-xs opacity-60 mt-3 sm:mt-4">
				{translations?.dashboard.needAdjust ?? 'Need to adjust the date or add notes? Use the'} <a href="{base}/add" class="underline">{translations?.dashboard.fullForm ?? 'full form'}</a>.
			</p>
		</div>

		<!-- Stats Summary -->
		{#if statsGrid.length === 0}
			<!-- Enhanced Empty State -->
			<div class="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-5 sm:p-8 text-center">
				<div class="text-5xl sm:text-6xl mb-3 sm:mb-4">🎯</div>
				<h2 class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-2">{translations?.dashboard.welcome ?? 'Welcome to Resolution Recap!'}</h2>
				<p class="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 max-w-md mx-auto">
					{translations?.dashboard.welcomeSubtitle ?? 'Track your progress and compete with friends'}
				</p>
				
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-left max-w-2xl mx-auto">
					<div class="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm">
						<div class="text-xl sm:text-2xl mb-1 sm:mb-2">1️⃣</div>
						<h3 class="font-semibold text-sm sm:text-base text-gray-800 dark:text-white">{translations?.dashboard.tapQuickAdd ?? 'Tap Quick Add'}</h3>
						<p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{translations?.dashboard.selectActivity ?? 'Select a person and activity type to log'}</p>
					</div>
					<div class="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm">
						<div class="text-xl sm:text-2xl mb-1 sm:mb-2">2️⃣</div>
						<h3 class="font-semibold text-sm sm:text-base text-gray-800 dark:text-white">{translations?.dashboard.buildStreaks ?? 'Build Streaks'}</h3>
						<p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{translations?.dashboard.logDaily ?? 'Log daily to build your 🔥 streak'}</p>
					</div>
					<div class="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm">
						<div class="text-xl sm:text-2xl mb-1 sm:mb-2">3️⃣</div>
						<h3 class="font-semibold text-sm sm:text-base text-gray-800 dark:text-white">{translations?.dashboard.reachGoals ?? 'Reach Goals'}</h3>
						<p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{translations?.dashboard.watchProgress ?? 'Watch your progress grow over time'}</p>
					</div>
				</div>
				
				<div class="hidden sm:block mt-6 text-sm text-gray-400 dark:text-gray-500">
					💡 Tip: On desktop, use keyboard shortcuts for faster logging!
				</div>
			</div>
		{:else if viewMode === 'leaderboard' && selectedLeaderboardMetric}
			<!-- Metric-Specific Leaderboard View -->
			<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
				<div class="bg-gradient-to-r from-yellow-500 to-orange-500 px-4 sm:px-6 py-3 sm:py-4">
					<h2 class="text-base sm:text-xl font-bold text-white flex flex-wrap items-center gap-1.5 sm:gap-2">
						{getMetricEmoji(selectedLeaderboardMetric)} {selectedLeaderboardMetric} Leaderboard
						<span class="text-xs sm:text-sm font-normal opacity-80">— {selectedPeriod === 'all' ? 'All Time' : selectedPeriod === 'month' ? 'This Month' : selectedPeriod === 'week' ? 'This Week' : 'Today'}</span>
					</h2>
				</div>
				<div class="divide-y dark:divide-gray-700">
					{#each metricLeaderboard as row, index}
						{@const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
						{@const count = row.metricCount}
						<div class="px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-4 {index < 3 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}">
							<div class="text-xl sm:text-2xl w-8 sm:w-10 text-center flex-shrink-0">{medal}</div>
							<div class="text-2xl sm:text-3xl flex-shrink-0">{row.personEmoji}</div>
							<div class="flex-1 min-w-0">
								<div class="font-bold text-base sm:text-lg text-gray-800 dark:text-white truncate">{row.personName}</div>
								<div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
									{count === 0 ? 'No entries yet' : count === 1 ? '1 entry' : `${count} entries`}
								</div>
							</div>
							<div class="text-right flex-shrink-0">
								<div class="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">{count}</div>
								<div class="text-[10px] sm:text-xs text-gray-400">{getMetricEmoji(selectedLeaderboardMetric)}</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<!-- Mobile cards with swipe -->
			<div class="md:hidden space-y-3">
				<!-- Swipe hint -->
				{#if data.metrics && data.metrics.length >= 2}
					<div class="text-center text-[10px] sm:text-xs text-white/60 flex items-center justify-center gap-3 sm:gap-4 px-2">
						<span>← swipe for {data.metrics[1]?.name}</span>
						<span>swipe for {data.metrics[0]?.name} →</span>
					</div>
				{/if}
				{#each statsGrid as row}
					{@const isActiveSwipe = swipeActiveRow?.personId === row.personId}
					{@const swipeDelta = isActiveSwipe ? swipeCurrentX - swipeStartX : 0}
					{@const isExpanded = expandedPersonId === row.personId}
					<div 
						class="bg-white dark:bg-gray-800 rounded-xl shadow p-3 sm:p-4 relative overflow-hidden touch-pan-y transition-all"
						ontouchstart={(e) => handleRowTouchStart(e, { id: row.personId, name: row.personName, emoji: row.personEmoji })}
						ontouchmove={handleRowTouchMove}
						ontouchend={handleRowTouchEnd}
						style="transform: translateX({swipeDelta * 0.3}px); transition: {isActiveSwipe ? 'none' : 'transform 0.2s ease-out'}"
					>
						<!-- Swipe indicators -->
						{#if isActiveSwipe && Math.abs(swipeDelta) > 20}
							<div class="absolute inset-y-0 {swipeDelta > 0 ? 'left-0' : 'right-0'} w-16 flex items-center justify-center {swipeDelta > 0 ? 'bg-gradient-to-r from-green-500/80' : 'bg-gradient-to-l from-blue-500/80'} to-transparent">
								<span class="text-white text-2xl">{swipeDelta > 0 ? getMetricEmoji(data.metrics?.[0]?.name || '') : getMetricEmoji(data.metrics?.[1]?.name || '')}</span>
							</div>
						{/if}
						
						<!-- Clickable header to expand -->
						<button 
							class="w-full text-left font-semibold text-base sm:text-lg text-gray-800 dark:text-white mb-2 sm:mb-3 flex items-center gap-2"
							onclick={() => togglePersonExpand(row.personId)}
						>
							<span class="text-xl sm:text-2xl">{row.personEmoji}</span>
							<span class="flex-1 truncate">{row.personName}</span>
							<span class="text-gray-400 text-xs sm:text-sm transition-transform flex-shrink-0 {isExpanded ? 'rotate-180' : ''}">▼</span>
						</button>
						
						<div class="grid grid-cols-2 gap-2 sm:gap-3">
							{#each metricNames as metric}
								{@const metricId = row.metrics[metric]?.metricId}
								{@const optimisticCount = getOptimisticCount(row.personId, metric, row.metrics[metric]?.count || 0)}
								{@const hasOptimistic = optimisticUpdates.has(`${row.personId}-${metric}`)}
								{@const sparklineData = sparklineMap.get(`${row.personId}-${metricId}`) || []}
								{@const weeklyDiff = metricId ? getWeeklyDiff(row.personId, metricId) : null}
								{@const streak = metricId ? getStreak(row.personId, metricId) : null}
								{@const goal = metricId ? getGoalProgress(row.personId, metricId) : null}
								{@const isAnimating = animatingCounters.has(`${row.personId}-${metric}`)}
								<button
									onclick={() => showConfirmation(row.personId, row.personName, row.personEmoji, row.metrics[metric]?.metricId, metric)}
									class="bg-gray-50 dark:bg-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-lg p-2 sm:p-3 text-center transition-colors group relative active:scale-95"
								>
									<div class="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform {hasOptimistic ? 'animate-pulse' : ''} {isAnimating ? 'counter-animate' : ''}">
										{optimisticCount}
									</div>
									<div class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1 truncate">{getTranslatedMetricName(metric)}</div>
									
									<!-- Streak indicator -->
									{#if streak && streak.current > 0}
										<div class="text-[9px] sm:text-[10px] text-orange-500 font-medium mt-0.5">
											🔥 {streak.current}d
										</div>
									{/if}
									
									<!-- Goal progress bar -->
									{#if goal}
										<div class="mt-1.5 sm:mt-2">
											<div class="h-1 sm:h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
												<div 
													class="h-full rounded-full transition-all {goal.percentage >= 100 ? 'bg-green-500' : 'bg-indigo-500'}"
													style="width: {goal.percentage}%"
												></div>
											</div>
											<div class="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">{goal.current}/{goal.target}</div>
										</div>
									{/if}
									
									<!-- Weekly comparison badge -->
									{#if weeklyDiff && weeklyDiff.diff !== 0}
										<div class="absolute -top-1 -right-1 px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold {weeklyDiff.diff > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}">
											{weeklyDiff.diff > 0 ? '+' : ''}{weeklyDiff.diff}
										</div>
									{/if}
									
									<!-- Mini sparkline -->
									{#if sparklineData.some(v => v > 0)}
										<svg class="w-full h-4 mt-1 opacity-50" viewBox="0 0 60 20" preserveAspectRatio="none">
											<path 
												d={getSparklinePath(sparklineData)} 
												fill="none" 
												stroke="currentColor" 
												stroke-width="2"
												class="text-indigo-400"
											/>
										</svg>
									{/if}
								</button>
							{/each}
						</div>
						
						<!-- Expandable recent history -->
						{#if isExpanded}
							<div class="mt-4 pt-4 border-t dark:border-gray-700">
								<h4 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">📜 {translations?.dashboard.recentActivity ?? 'Recent Activity'}</h4>
								{#if personHistory.get(row.personId)?.length}
									<div class="space-y-2 max-h-40 overflow-y-auto">
										{#each personHistory.get(row.personId) || [] as entry}
											<div class="flex items-center gap-2 text-sm">
												<span class="text-gray-400">{new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
												<span>{getMetricEmoji(entry.metric_name)}</span>
												<span class="text-gray-600 dark:text-gray-300">{entry.metric_name}</span>
												{#if entry.notes}
													<span class="text-amber-500 text-xs">📝</span>
												{/if}
											</div>
										{/each}
									</div>
								{:else}
									<p class="text-sm text-gray-400">{translations?.dashboard.noRecentEntries ?? 'No recent entries'}</p>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Desktop table with clickable cells -->
			<div class="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
				<table class="w-full">
					<thead class="bg-gray-50 dark:bg-gray-700">
						<tr>
							<th class="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">{translations?.dashboard.person ?? 'Person'}</th>
							{#each metricNames as metric}
								<th class="px-6 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-200">
									<div>{getTranslatedMetricName(metric)}</div>
									<div class="text-[10px] font-normal text-gray-400">7-day trend</div>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-700">
						{#each statsGrid as row}
							{@const isExpanded = expandedPersonId === row.personId}
							<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
								<td class="px-6 py-4 font-medium text-gray-800 dark:text-white">
									<button 
										onclick={() => togglePersonExpand(row.personId)}
										class="inline-flex items-center gap-2 hover:text-indigo-600 transition-colors"
									>
										<span class="text-xl">{row.personEmoji}</span>
										<span>{row.personName}</span>
										<span class="text-gray-400 text-xs transition-transform {isExpanded ? 'rotate-180' : ''}">▼</span>
									</button>
								</td>
								{#each metricNames as metric}
									{@const metricId = row.metrics[metric]?.metricId}
									{@const optimisticCount = getOptimisticCount(row.personId, metric, row.metrics[metric]?.count || 0)}
									{@const hasOptimistic = optimisticUpdates.has(`${row.personId}-${metric}`)}
									{@const sparklineData = sparklineMap.get(`${row.personId}-${metricId}`) || []}
									{@const weeklyDiff = metricId ? getWeeklyDiff(row.personId, metricId) : null}
									{@const streak = metricId ? getStreak(row.personId, metricId) : null}
									{@const goal = metricId ? getGoalProgress(row.personId, metricId) : null}
									{@const isAnimating = animatingCounters.has(`${row.personId}-${metric}`)}
									<td class="px-6 py-4 text-center">
										<div class="flex flex-col items-center gap-1">
											<div class="relative">
												<button
													onclick={() => showConfirmation(row.personId, row.personName, row.personEmoji, row.metrics[metric]?.metricId, metric)}
													class="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 hover:scale-110 transition-all group {hasOptimistic ? 'animate-pulse ring-2 ring-green-400' : ''} {isAnimating ? 'counter-animate' : ''}"
													title="Click to add +1"
												>
													{optimisticCount}
												</button>
												<!-- Weekly comparison badge -->
												{#if weeklyDiff && weeklyDiff.diff !== 0}
													<div class="absolute -top-1 -right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold {weeklyDiff.diff > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}">
														{weeklyDiff.diff > 0 ? '+' : ''}{weeklyDiff.diff}
													</div>
												{/if}
											</div>
											
											<!-- Streak indicator -->
											{#if streak && streak.current > 0}
												<div class="text-[10px] text-orange-500 font-medium">
													🔥 {streak.current}d
												</div>
											{/if}
											
											<!-- Goal progress bar -->
											{#if goal}
												<div class="w-16">
													<div class="h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
														<div 
															class="h-full rounded-full transition-all {goal.percentage >= 100 ? 'bg-green-500' : 'bg-indigo-500'}"
															style="width: {goal.percentage}%"
														></div>
													</div>
													<div class="text-[9px] text-gray-400 text-center">{goal.current}/{goal.target}</div>
												</div>
											{/if}
											
											<!-- Mini sparkline -->
											{#if sparklineData.some(v => v > 0)}
												<svg class="w-16 h-4 opacity-60" viewBox="0 0 60 20" preserveAspectRatio="none">
													<path 
														d={getSparklinePath(sparklineData)} 
														fill="none" 
														stroke="currentColor" 
														stroke-width="2"
														class="text-indigo-400"
													/>
												</svg>
											{:else}
												<div class="w-16 h-4 flex items-center justify-center">
													<span class="text-[10px] text-gray-300">no data</span>
												</div>
											{/if}
										</div>
									</td>
								{/each}
							</tr>
							<!-- Expandable row for history -->
							{#if isExpanded}
								<tr class="bg-gray-50 dark:bg-gray-900">
									<td colspan={metricNames.length + 1} class="px-6 py-4">
										<div class="flex items-start gap-4">
											<div class="flex-1">
												<h4 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">📜 Recent Activity for {row.personName}</h4>
												{#if personHistory.get(row.personId)?.length}
													<div class="flex flex-wrap gap-2">
														{#each personHistory.get(row.personId) || [] as entry}
															<div class="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 text-sm shadow-sm flex items-center gap-2">
																<span class="text-gray-400">{new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
																<span>{getMetricEmoji(entry.metric_name)}</span>
																<span class="text-gray-600 dark:text-gray-300">{entry.metric_name}</span>
																{#if entry.notes}
																	<span class="text-amber-500" title={entry.notes}>📝</span>
																{/if}
															</div>
														{/each}
													</div>
												{:else}
													<p class="text-sm text-gray-400">Loading...</p>
												{/if}
											</div>
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
				<div class="bg-gray-50 dark:bg-gray-700 px-6 py-2 text-xs text-gray-400 text-center">
					💡 Click any number to quickly add +1 for today · Click a name to see recent history
				</div>
			</div>
		{/if}

		<!-- Recent Entries -->
		{#if data.recentEntries?.length > 0}
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
				<div class="bg-gray-50 dark:bg-gray-700 px-3 sm:px-4 py-2 sm:py-3 border-b dark:border-gray-600">
					<h2 class="font-semibold text-sm sm:text-base text-gray-700 dark:text-gray-200">🕐 Recent Entries</h2>
				</div>
				<div class="divide-y dark:divide-gray-700">
					{#each data.recentEntries.slice(0, 8) as entry}
						<div class="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
							<span class="text-lg sm:text-xl flex-shrink-0">{entry.person_emoji || '👤'}</span>
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm sm:text-base text-gray-800 dark:text-white truncate flex items-center gap-1.5 sm:gap-2">
									<span class="truncate">{entry.person_name}</span>
									<span class="text-gray-400">·</span>
									<span class="truncate">{entry.metric_name}</span>
									{#if entry.notes}
										<span class="text-amber-500 flex-shrink-0" title={entry.notes}>📝</span>
									{/if}
								</div>
								<div class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
									{new Date(entry.entry_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
									{#if entry.notes}
										<span class="hidden sm:inline italic text-gray-400 dark:text-gray-500 ml-1">"{entry.notes.substring(0, 40)}{entry.notes.length > 40 ? '...' : ''}"</span>
									{/if}
								</div>
							</div>
							<span class="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
								{formatTimeAgo(entry.created_at)}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Previous Seasons Mini Teaser -->
		<a 
			href="{base}/history"
			class="block bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800 hover:shadow-lg transition-all group"
		>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<span class="text-2xl">📜</span>
					<div>
						<div class="font-semibold text-gray-800 dark:text-white text-sm">Previous Seasons</div>
						<div class="text-xs text-gray-500 dark:text-gray-400">
							🏃 2025: Cas won with 147 · 🎂 2024: Joris won with 33
						</div>
					</div>
				</div>
				<span class="text-gray-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all">→</span>
			</div>
		</a>
	{/if}
</div>
