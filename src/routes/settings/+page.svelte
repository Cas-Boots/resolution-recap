<script lang="ts">
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { base } from '$app/paths';
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

	// People management
	let newPersonName = $state('');
	let newPersonEmoji = $state('👤');
	let editingPersonId = $state<number | null>(null);
	let editingPersonName = $state('');
	let editingPersonEmoji = $state('');
	let personLoading = $state(false);

	// Metrics management  
	let newMetricName = $state('');
	let newMetricEmoji = $state('📊');
	let newMetricNameNl = $state('');
	let editingMetricId = $state<number | null>(null);
	let editingMetricName = $state('');
	let editingMetricEmoji = $state('');
	let editingMetricNameNl = $state('');
	let metricLoading = $state(false);

	// Add person
	async function addPerson() {
		if (!newPersonName.trim()) return;
		personLoading = true;
		
		await fetch(`${base}/api/people`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newPersonName.trim(), emoji: newPersonEmoji || '👤' })
		});
		
		newPersonName = '';
		newPersonEmoji = '👤';
		personLoading = false;
		await invalidateAll();
	}

	// Update person
	async function updatePerson(id: number, name: string, isActive: boolean, emoji?: string) {
		personLoading = true;
		
		await fetch(`${base}/api/people`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, name, isActive, emoji })
		});
		
		editingPersonId = null;
		personLoading = false;
		await invalidateAll();
	}

	// Add metric
	async function addMetric() {
		if (!newMetricName.trim()) return;
		metricLoading = true;
		
		await fetch(`${base}/api/metrics`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newMetricName.trim(), emoji: newMetricEmoji || '📊', name_nl: newMetricNameNl.trim() || null })
		});
		
		newMetricName = '';
		newMetricEmoji = '📊';
		newMetricNameNl = '';
		metricLoading = false;
		await invalidateAll();
	}

	// Update metric
	async function updateMetric(id: number, name: string, isActive: boolean, emoji?: string, nameNl?: string) {
		metricLoading = true;
		
		await fetch(`${base}/api/metrics`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, name, isActive, emoji, name_nl: nameNl || null })
		});
		
		editingMetricId = null;
		metricLoading = false;
		await invalidateAll();
	}

	// Goals management
	let goalLoading = $state(false);

	// Build goals map for easy lookup
	const goalsMap = $derived.by(() => {
		const map = new Map<string, number>();
		for (const goal of data.goals || []) {
			map.set(`${goal.person_id}-${goal.metric_id}`, goal.target);
		}
		return map;
	});

	function getGoalValue(personId: number, metricId: number): number {
		return goalsMap.get(`${personId}-${metricId}`) || 0;
	}

	async function saveGoal(personId: number, metricId: number, target: number) {
		goalLoading = true;
		
		if (target > 0) {
			await fetch(`${base}/api/goals`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ personId, metricId, target })
			});
		} else {
			await fetch(`${base}/api/goals?personId=${personId}&metricId=${metricId}`, {
				method: 'DELETE'
			});
		}
		
		goalLoading = false;
		await invalidateAll();
	}

	// Countries management
	let countryLoading = $state(false);
	let selectedPersonForCountry = $state<number | null>(null);
	let newCountryCode = $state('');
	let newCountryName = $state('');

	// Common countries list (including Netherlands as home country)
	const COMMON_COUNTRIES = [
		{ code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
		{ code: 'BE', name: 'Belgium', flag: '🇧🇪' },
		{ code: 'DE', name: 'Germany', flag: '🇩🇪' },
		{ code: 'FR', name: 'France', flag: '🇫🇷' },
		{ code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
		{ code: 'ES', name: 'Spain', flag: '🇪🇸' },
		{ code: 'PT', name: 'Portugal', flag: '🇵🇹' },
		{ code: 'IT', name: 'Italy', flag: '🇮🇹' },
		{ code: 'AT', name: 'Austria', flag: '🇦🇹' },
		{ code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
		{ code: 'GR', name: 'Greece', flag: '🇬🇷' },
		{ code: 'HR', name: 'Croatia', flag: '🇭🇷' },
		{ code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
		{ code: 'PL', name: 'Poland', flag: '🇵🇱' },
		{ code: 'DK', name: 'Denmark', flag: '🇩🇰' },
		{ code: 'SE', name: 'Sweden', flag: '🇸🇪' },
		{ code: 'NO', name: 'Norway', flag: '🇳🇴' },
		{ code: 'FI', name: 'Finland', flag: '🇫🇮' },
		{ code: 'IE', name: 'Ireland', flag: '🇮🇪' },
		{ code: 'US', name: 'United States', flag: '🇺🇸' },
		{ code: 'CA', name: 'Canada', flag: '🇨🇦' },
		{ code: 'AU', name: 'Australia', flag: '🇦🇺' },
		{ code: 'JP', name: 'Japan', flag: '🇯🇵' },
		{ code: 'TH', name: 'Thailand', flag: '🇹🇭' },
		{ code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
		{ code: 'TR', name: 'Turkey', flag: '🇹🇷' },
		{ code: 'MA', name: 'Morocco', flag: '🇲🇦' },
		{ code: 'EG', name: 'Egypt', flag: '🇪🇬' },
		{ code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
		{ code: 'MX', name: 'Mexico', flag: '🇲🇽' }
	];

	// Build countries map for easy lookup
	const countriesMap = $derived.by(() => {
		const map = new Map<number, Set<string>>();
		for (const visit of data.countriesVisited || []) {
			if (!map.has(visit.person_id)) {
				map.set(visit.person_id, new Set());
			}
			map.get(visit.person_id)!.add(visit.country_code);
		}
		return map;
	});

	function hasVisitedCountry(personId: number, countryCode: string): boolean {
		return countriesMap.get(personId)?.has(countryCode) || false;
	}

	function getPersonCountryCount(personId: number): number {
		return countriesMap.get(personId)?.size || 0;
	}

	async function toggleCountry(personId: number, countryCode: string, countryName: string) {
		countryLoading = true;
		
		if (hasVisitedCountry(personId, countryCode)) {
			await fetch(`${base}/api/countries?personId=${personId}&countryCode=${countryCode}`, {
				method: 'DELETE'
			});
		} else {
			await fetch(`${base}/api/countries`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ personId, countryCode, countryName })
			});
		}
		
		countryLoading = false;
		await invalidateAll();
	}

	async function addCustomCountry(personId: number) {
		if (!newCountryCode.trim() || !newCountryName.trim()) return;
		countryLoading = true;
		
		await fetch(`${base}/api/countries`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ 
				personId, 
				countryCode: newCountryCode.trim().toUpperCase(), 
				countryName: newCountryName.trim() 
			})
		});
		
		newCountryCode = '';
		newCountryName = '';
		countryLoading = false;
		await invalidateAll();
	}
</script>

<div class="space-y-6">
	<div class="bg-white rounded-2xl shadow-lg p-6">
		<h1 class="text-2xl font-bold text-gray-800">⚙️ {translations?.nav.settings ?? 'Settings'}</h1>
		<p class="text-gray-500 mt-1">Manage people and metrics</p>
	</div>

	<!-- People Section -->
	<div class="bg-white rounded-xl shadow-lg overflow-hidden">
		<div class="bg-indigo-50 px-4 py-3 border-b">
			<h2 class="font-semibold text-indigo-800">👥 People</h2>
		</div>
		
		<div class="p-4 space-y-3">
			<!-- Add new person -->
			<form onsubmit={(e) => { e.preventDefault(); addPerson(); }} class="flex gap-2">
				<input
					type="text"
					bind:value={newPersonEmoji}
					placeholder="😀"
					class="w-14 px-2 py-2 border rounded-lg focus:border-indigo-500 focus:outline-none text-center text-xl"
					maxlength="2"
					disabled={personLoading}
				/>
				<input
					type="text"
					bind:value={newPersonName}
					placeholder="New person name..."
					class="flex-1 px-3 py-2 border rounded-lg focus:border-indigo-500 focus:outline-none"
					disabled={personLoading}
				/>
				<button
					type="submit"
					disabled={personLoading || !newPersonName.trim()}
					class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
				>
					Add
				</button>
			</form>

			<!-- People list -->
			<div class="divide-y">
				{#each data.people || [] as person}
					<div class="py-3 flex items-center gap-3">
						{#if editingPersonId === person.id}
							<input
								type="text"
								bind:value={editingPersonEmoji}
								class="w-14 px-2 py-2 border rounded-lg focus:border-indigo-500 focus:outline-none text-center text-xl"
								maxlength="2"
							/>
							<input
								type="text"
								bind:value={editingPersonName}
								class="flex-1 px-3 py-2 border rounded-lg focus:border-indigo-500 focus:outline-none"
							/>
							<button
								onclick={() => updatePerson(person.id, editingPersonName, !!person.is_active, editingPersonEmoji)}
								class="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
							>
								Save
							</button>
							<button
								onclick={() => editingPersonId = null}
								class="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
							>
								Cancel
							</button>
						{:else}
							<span class="text-xl">{person.emoji || '👤'}</span>
							<span class="flex-1 {person.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}">
								{person.name}
							</span>
							<button
								onclick={() => { editingPersonId = person.id; editingPersonName = person.name; editingPersonEmoji = person.emoji || '👤'; }}
								class="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
							>
								Edit
							</button>
							<button
								onclick={() => updatePerson(person.id, person.name, !person.is_active, person.emoji)}
								class="px-3 py-1 {person.is_active ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'} rounded-lg text-sm"
							>
								{person.is_active ? 'Deactivate' : 'Activate'}
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Metrics Section -->
	<div class="bg-white rounded-xl shadow-lg overflow-hidden">
		<div class="bg-purple-50 px-4 py-3 border-b">
			<h2 class="font-semibold text-purple-800">📏 Metrics</h2>
		</div>
		
		<div class="p-4 space-y-3">
			<!-- Add new metric -->
			<form onsubmit={(e) => { e.preventDefault(); addMetric(); }} class="space-y-2">
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={newMetricEmoji}
						placeholder="📊"
						class="w-14 px-2 py-2 border rounded-lg text-center text-xl focus:border-purple-500 focus:outline-none"
						maxlength="2"
					/>
					<input
						type="text"
						bind:value={newMetricName}
						placeholder="Metric name (English)..."
						class="flex-1 px-3 py-2 border rounded-lg focus:border-purple-500 focus:outline-none"
						disabled={metricLoading}
					/>
					<input
						type="text"
						bind:value={newMetricNameNl}
						placeholder="🇳🇱 Dutch name..."
						class="flex-1 px-3 py-2 border rounded-lg focus:border-purple-500 focus:outline-none"
						disabled={metricLoading}
					/>
					<button
						type="submit"
						disabled={metricLoading || !newMetricName.trim()}
						class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
					>
						Add
					</button>
				</div>
			</form>

			<div class="divide-y">
				{#each data.metrics || [] as metric}
					<div class="py-3 flex items-center gap-3">
						{#if editingMetricId === metric.id}
							<input
								type="text"
								bind:value={editingMetricEmoji}
								class="w-12 px-2 py-2 border rounded-lg text-center text-xl focus:border-purple-500 focus:outline-none"
								maxlength="2"
							/>
							<input
								type="text"
								bind:value={editingMetricName}
								placeholder="English name"
								class="flex-1 px-3 py-2 border rounded-lg focus:border-purple-500 focus:outline-none"
							/>
							<input
								type="text"
								bind:value={editingMetricNameNl}
								placeholder="🇳🇱 Dutch name"
								class="flex-1 px-3 py-2 border rounded-lg focus:border-purple-500 focus:outline-none"
							/>
							<button
								onclick={() => updateMetric(metric.id, editingMetricName, !!metric.is_active, editingMetricEmoji, editingMetricNameNl)}
								class="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
							>
								Save
							</button>
							<button
								onclick={() => editingMetricId = null}
								class="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
							>
								Cancel
							</button>
						{:else}
							<span class="text-xl">{metric.emoji || '📊'}</span>
							<div class="flex-1 {metric.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}">
								<span>{metric.name}</span>
								{#if metric.name_nl}
									<span class="text-sm text-gray-500 ml-2">🇳🇱 {metric.name_nl}</span>
								{/if}
							</div>
							<button
								onclick={() => { editingMetricId = metric.id; editingMetricName = metric.name; editingMetricEmoji = metric.emoji || '📊'; editingMetricNameNl = metric.name_nl || ''; }}
								class="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
							>
								Edit
							</button>
							<button
								onclick={() => updateMetric(metric.id, metric.name, !metric.is_active, metric.emoji, metric.name_nl ?? undefined)}
								class="px-3 py-1 {metric.is_active ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'} rounded-lg text-sm"
							>
								{metric.is_active ? 'Deactivate' : 'Activate'}
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-sm">
		<strong>💡 Tip:</strong> Deactivating a person or metric hides them from dropdowns but keeps historical data intact.
	</div>

	<!-- Goals Section -->
	{#if data.season}
		<div class="bg-white rounded-xl shadow-lg overflow-hidden">
			<div class="bg-green-50 px-4 py-3 border-b">
				<h2 class="font-semibold text-green-800">🎯 Goals for {data.season.name}</h2>
				<p class="text-sm text-green-600 mt-1">Set expected targets for each person per metric</p>
			</div>
			
			<div class="p-4">
				{#each (data.metrics || []).filter((m: { is_active: number }) => m.is_active).sort((a: { name: string }, b: { name: string }) => {
					// Sporting first
					if (a.name.toLowerCase() === 'sporting') return -1;
					if (b.name.toLowerCase() === 'sporting') return 1;
					return a.name.localeCompare(b.name);
				}) as metric}
					<div class="mb-6 last:mb-0">
						<div class="flex items-center gap-2 mb-3">
							<span class="text-xl">{metric.emoji}</span>
							<h3 class="font-medium text-gray-800">{metric.name}</h3>
						</div>
						<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
							{#each (data.people || []).filter((p: { is_active: number }) => p.is_active) as person}
								{@const currentGoal = getGoalValue(person.id, metric.id)}
								<div class="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
									<span>{person.emoji}</span>
									<span class="text-sm text-gray-700 flex-1 truncate">{person.name}</span>
									<input
										type="number"
										min="0"
										max="999"
										value={currentGoal}
										onchange={(e) => saveGoal(person.id, metric.id, parseInt((e.target as HTMLInputElement).value) || 0)}
										class="w-16 px-2 py-1 text-sm border rounded focus:border-green-500 focus:outline-none text-center"
										disabled={goalLoading}
									/>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 text-sm">
			<strong>💡 Tip:</strong> Goals help track progress. Set to 0 to remove a goal. Check the Stats page to see how everyone is doing!
		</div>

		<!-- Countries Section -->
		<div class="bg-white rounded-xl shadow-lg overflow-hidden">
			<div class="bg-teal-50 px-4 py-3 border-b">
				<h2 class="font-semibold text-teal-800">🌍 Countries Visited</h2>
				<p class="text-sm text-teal-600 mt-1">Track which countries each person visited this year (including Netherlands 🇳🇱)</p>
			</div>
			
			<div class="p-4">
				{#each (data.people || []).filter((p: { is_active: number }) => p.is_active) as person}
					<div class="mb-6 last:mb-0">
						<div class="flex items-center gap-2 mb-3">
							<span class="text-xl">{person.emoji}</span>
							<h3 class="font-medium text-gray-800">{person.name}</h3>
							<span class="text-sm text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full">
								{getPersonCountryCount(person.id)} countries
							</span>
							<button
								onclick={() => selectedPersonForCountry = selectedPersonForCountry === person.id ? null : person.id}
								class="ml-auto text-sm text-teal-600 hover:text-teal-800"
							>
								{selectedPersonForCountry === person.id ? '▼ Hide' : '▶ Edit'}
							</button>
						</div>
						
						{#if selectedPersonForCountry === person.id}
							<div class="bg-gray-50 rounded-lg p-3 space-y-3">
								<!-- Quick select common countries -->
								<div class="flex flex-wrap gap-2">
									{#each COMMON_COUNTRIES as country}
										<button
											onclick={() => toggleCountry(person.id, country.code, country.name)}
											disabled={countryLoading}
											class="px-2 py-1 text-sm rounded-lg transition-colors {hasVisitedCountry(person.id, country.code) ? 'bg-teal-500 text-white' : 'bg-white border hover:bg-gray-100'}"
											title={country.name}
										>
											{country.flag} {country.code}
										</button>
									{/each}
								</div>
								
								<!-- Add custom country -->
								<div class="flex gap-2 pt-2 border-t">
									<input
										type="text"
										bind:value={newCountryCode}
										placeholder="Code (e.g. BR)"
										maxlength="3"
										class="w-20 px-2 py-1 text-sm border rounded-lg focus:border-teal-500 focus:outline-none uppercase"
										disabled={countryLoading}
									/>
									<input
										type="text"
										bind:value={newCountryName}
										placeholder="Country name (e.g. Brazil)"
										class="flex-1 px-2 py-1 text-sm border rounded-lg focus:border-teal-500 focus:outline-none"
										disabled={countryLoading}
									/>
									<button
										onclick={() => addCustomCountry(person.id)}
										disabled={countryLoading || !newCountryCode.trim() || !newCountryName.trim()}
										class="px-3 py-1 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
									>
										Add
									</button>
								</div>
							</div>
						{:else}
							<!-- Show visited countries summary -->
							<div class="flex flex-wrap gap-1">
								{#each COMMON_COUNTRIES.filter(c => hasVisitedCountry(person.id, c.code)) as country}
									<span class="text-lg" title={country.name}>{country.flag}</span>
								{/each}
								{#if getPersonCountryCount(person.id) === 0}
									<span class="text-sm text-gray-400">No countries recorded yet</span>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<div class="bg-teal-50 border border-teal-200 rounded-xl p-4 text-teal-800 text-sm">
			<strong>💡 Tip:</strong> Track all the countries visited this year! This data will appear in the New Year's quiz reveal to show who traveled the most. Don't forget to include the Netherlands 🇳🇱 as our home country!
		</div>
	{/if}
</div>
