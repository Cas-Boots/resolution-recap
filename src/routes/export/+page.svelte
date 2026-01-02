<script lang="ts">
	import type { PageData } from './$types';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { t } from '$lib/stores/locale';
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
	
	let selectedPerson = $state(data.selectedPersonId);

	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	// Group stats by person
	const personStats = $derived.by(() => {
		if (!data.stats) return new Map();
		const grouped = new Map<number, { name: string; emoji: string; total: number; metrics: Record<string, number> }>();
		
		for (const stat of data.stats) {
			if (!grouped.has(stat.person_id)) {
				grouped.set(stat.person_id, { name: stat.person_name, emoji: stat.person_emoji, total: 0, metrics: {} });
			}
			const person = grouped.get(stat.person_id)!;
			person.total += stat.count;
			person.metrics[stat.metric_name] = stat.count;
		}
		
		return grouped;
	});

	// Get monthly data for selected person
	const personMonthlyData = $derived.by(() => {
		if (!selectedPerson || !data.monthlyStats) return [];
		const person = data.people?.find(p => p.id === selectedPerson);
		if (!person) return [];
		
		return data.monthlyStats.filter(s => s.person_name === person.name);
	});

	// Get streaks for selected person
	const personStreaks = $derived.by(() => {
		if (!selectedPerson || !data.streaks || !data.metrics) return [];
		
		return data.metrics.map(metric => {
			const streakData = data.streaks[metric.id]?.find(s => s.person_id === selectedPerson);
			return {
				metric,
				streaks: streakData || null
			};
		});
	});

	// Get goals for selected person
	const personGoals = $derived.by(() => {
		if (!selectedPerson || !data.goals) return [];
		return data.goals.filter(g => g.person_id === selectedPerson);
	});

	function selectPerson(id: number) {
		selectedPerson = id;
		goto(`${base}/export?person=${id}`);
	}

	function printPage() {
		window.print();
	}

	function downloadCSV() {
		if (!data.entries) return;
		
		const headers = ['Date', 'Person', 'Metric', 'Notes'];
		const rows = data.entries.map(e => [
			e.entry_date,
			e.person_name,
			e.metric_name,
			e.notes || ''
		]);
		
		const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `resolution-recap-${data.season?.year || 'export'}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<style>
		@media print {
			body { 
				-webkit-print-color-adjust: exact !important;
				print-color-adjust: exact !important;
			}
			.no-print { display: none !important; }
			.print-break { page-break-before: always; }
		}
	</style>
</svelte:head>

<div class="min-h-screen bg-gray-100 p-4 print:bg-white print:p-0">
	<!-- Header - no print -->
	<div class="no-print max-w-4xl mx-auto mb-6">
		<div class="bg-white rounded-xl shadow-lg p-4 flex items-center justify-between">
			<a href="{base}/stats" class="text-indigo-600 hover:text-indigo-800 flex items-center gap-2">
				← Back to Stats
			</a>
			<h1 class="text-xl font-bold text-gray-800">📄 Export & Print</h1>
			<div class="flex gap-2">
				<button
					onclick={downloadCSV}
					class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
				>
					📥 Download CSV
				</button>
				<button
					onclick={printPage}
					class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
				>
					🖨️ Print
				</button>
			</div>
		</div>
	</div>

	{#if !data.season}
		<div class="max-w-4xl mx-auto bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center text-yellow-800">
			No active season found.
		</div>
	{:else}
		<!-- Person selector - no print -->
		<div class="no-print max-w-4xl mx-auto mb-6">
			<div class="bg-white rounded-xl shadow p-4">
				<h2 class="text-sm font-medium text-gray-600 mb-3">Select person for detailed view:</h2>
				<div class="flex flex-wrap gap-2">
					{#each data.people || [] as person}
						<button
							onclick={() => selectPerson(person.id)}
							class="px-4 py-2 rounded-lg font-medium transition-colors {selectedPerson === person.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
						>
							{person.emoji} {person.name}
						</button>
					{/each}
				</div>
			</div>
		</div>

		{#if selectedPerson}
			{@const person = data.people?.find(p => p.id === selectedPerson)}
			{@const stats = personStats.get(selectedPerson)}
			
			{#if person && stats}
				<!-- Printable Summary -->
				<div class="max-w-4xl mx-auto space-y-6">
					<!-- Header -->
					<div class="bg-white rounded-xl shadow-lg p-8 text-center print:shadow-none print:border print:border-gray-300">
						<div class="text-6xl mb-4">{person.emoji}</div>
						<h1 class="text-3xl font-bold text-gray-800">{person.name}'s Year in Review</h1>
						<p class="text-gray-500 mt-2">{data.season.name}</p>
					</div>

					<!-- Summary Stats -->
					<div class="bg-white rounded-xl shadow-lg p-6 print:shadow-none print:border print:border-gray-300">
						<h2 class="text-xl font-bold text-gray-800 mb-4">📊 Summary</h2>
						<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
							<div class="text-center p-4 bg-indigo-50 rounded-lg">
								<div class="text-3xl font-bold text-indigo-600">{stats.total}</div>
								<div class="text-sm text-gray-600">Total Entries</div>
							</div>
							{#each data.metrics || [] as metric}
								<div class="text-center p-4 bg-gray-50 rounded-lg">
									<div class="text-xl">{metric.emoji}</div>
									<div class="text-2xl font-bold text-gray-800">{stats.metrics[metric.name] || 0}</div>
									<div class="text-sm text-gray-600">{metric.name}</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Goals Progress -->
					{#if personGoals.length > 0}
						<div class="bg-white rounded-xl shadow-lg p-6 print:shadow-none print:border print:border-gray-300">
							<h2 class="text-xl font-bold text-gray-800 mb-4">🎯 Goals</h2>
							<div class="space-y-4">
								{#each personGoals as goal}
									{@const metric = data.metrics?.find(m => m.id === goal.metric_id)}
									{@const current = stats.metrics[metric?.name || ''] || 0}
									{@const percent = Math.min(100, Math.round((current / goal.target) * 100))}
									<div>
										<div class="flex justify-between mb-1">
											<span class="font-medium">{metric?.emoji} {metric?.name}</span>
											<span class="text-gray-600">{current} / {goal.target}</span>
										</div>
										<div class="h-4 bg-gray-200 rounded-full overflow-hidden">
											<div 
												class="h-full {percent >= 100 ? 'bg-green-500' : 'bg-indigo-500'}"
												style="width: {percent}%"
											></div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Streaks & Records -->
					<div class="bg-white rounded-xl shadow-lg p-6 print:shadow-none print:border print:border-gray-300 print-break">
						<h2 class="text-xl font-bold text-gray-800 mb-4">🔥 Streaks & Records</h2>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							{#each personStreaks as { metric, streaks }}
								{#if streaks && streaks.total_entries > 0}
									<div class="p-4 bg-orange-50 rounded-lg">
										<div class="flex items-center gap-2 mb-2">
											<span class="text-xl">{metric.emoji}</span>
											<span class="font-medium">{metric.name}</span>
										</div>
										<div class="space-y-1 text-sm">
											<div class="flex justify-between">
												<span class="text-gray-600">Total entries:</span>
												<span class="font-medium">{streaks.total_entries}</span>
											</div>
											{#if streaks.longest_daily_streak > 1}
												<div class="flex justify-between">
													<span class="text-gray-600">Longest daily streak:</span>
													<span class="font-medium">{streaks.longest_daily_streak} days</span>
												</div>
											{/if}
											{#if streaks.longest_weekly_streak > 1}
												<div class="flex justify-between">
													<span class="text-gray-600">Longest weekly streak:</span>
													<span class="font-medium">{streaks.longest_weekly_streak} weeks</span>
												</div>
											{/if}
											{#if streaks.busiest_day}
												<div class="flex justify-between">
													<span class="text-gray-600">Favorite day:</span>
													<span class="font-medium">{streaks.busiest_day}</span>
												</div>
											{/if}
											{#if streaks.busiest_month}
												<div class="flex justify-between">
													<span class="text-gray-600">Best month:</span>
													<span class="font-medium">{streaks.busiest_month}</span>
												</div>
											{/if}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					</div>

					<!-- Monthly Breakdown -->
					<div class="bg-white rounded-xl shadow-lg p-6 print:shadow-none print:border print:border-gray-300">
						<h2 class="text-xl font-bold text-gray-800 mb-4">📅 Monthly Breakdown</h2>
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b">
										<th class="text-left py-2 px-3">Month</th>
										{#each data.metrics || [] as metric}
											<th class="text-center py-2 px-3">{metric.emoji}</th>
										{/each}
										<th class="text-center py-2 px-3">Total</th>
									</tr>
								</thead>
								<tbody>
									{#each Array.from({ length: 12 }, (_, i) => `${data.season?.year}-${(i + 1).toString().padStart(2, '0')}`) as month, i}
										{@const monthData = personMonthlyData.filter(m => m.month === month)}
										{@const monthTotal = monthData.reduce((sum, m) => sum + m.count, 0)}
										<tr class="border-b {i % 2 === 0 ? 'bg-gray-50' : ''}">
											<td class="py-2 px-3 font-medium">{monthNames[i]}</td>
											{#each data.metrics || [] as metric}
												{@const count = monthData.find(m => m.metric_name === metric.name)?.count || 0}
												<td class="text-center py-2 px-3 {count > 0 ? 'text-indigo-600 font-medium' : 'text-gray-300'}">{count || '-'}</td>
											{/each}
											<td class="text-center py-2 px-3 font-bold">{monthTotal || '-'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			{/if}
		{:else}
			<!-- Group overview when no person selected -->
			<div class="max-w-4xl mx-auto">
				<div class="bg-white rounded-xl shadow-lg p-8 text-center">
					<div class="text-4xl mb-4">👆</div>
					<p class="text-gray-600">Select a person above to see their detailed report</p>
					<p class="text-sm text-gray-400 mt-2">Or download CSV for all data</p>
				</div>
			</div>
		{/if}
	{/if}
</div>
