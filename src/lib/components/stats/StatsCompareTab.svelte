<script lang="ts">
	interface PersonOption {
		id: number;
		name: string;
		emoji?: string | null;
	}

	interface ComparisonMetric {
		metric: string;
		emoji?: string | null;
		person1: number;
		person2: number;
		winner: number;
	}

	interface ComparisonData {
		person1: { id: number; name: string; emoji?: string | null; total: number };
		person2: { id: number; name: string; emoji?: string | null; total: number };
		comparison: ComparisonMetric[];
		wins1: number;
		wins2: number;
	}

	interface Props {
		people: PersonOption[];
		comparePersons?: [number | null, number | null];
		comparisonData: ComparisonData | null;
	}

	let {
		people,
		comparePersons = $bindable<[number | null, number | null]>([null, null]),
		comparisonData
	}: Props = $props();
</script>

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
				{#each people || [] as person}
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
				{#each people || [] as person}
					<option value={person.id} disabled={person.id === comparePersons[0]}>{person.emoji} {person.name}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if comparisonData}
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
