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

		try {
			const res = await fetch(`${base}/api/people`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newPersonName.trim(), emoji: newPersonEmoji || '👤' })
			});

			if (res.ok) {
				newPersonName = '';
				newPersonEmoji = '👤';
				await invalidateAll();
			}
		} finally {
			personLoading = false;
		}
	}

	// Update person
	async function updatePerson(id: number, name: string, isActive: boolean, emoji?: string) {
		personLoading = true;

		try {
			const res = await fetch(`${base}/api/people`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, name, isActive, emoji })
			});

			if (res.ok) {
				editingPersonId = null;
				await invalidateAll();
			}
		} finally {
			personLoading = false;
		}
	}

	// Add metric
	async function addMetric() {
		if (!newMetricName.trim()) return;
		metricLoading = true;

		try {
			const res = await fetch(`${base}/api/metrics`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newMetricName.trim(), emoji: newMetricEmoji || '📊', name_nl: newMetricNameNl.trim() || null })
			});

			if (res.ok) {
				newMetricName = '';
				newMetricEmoji = '📊';
				newMetricNameNl = '';
				await invalidateAll();
			}
		} finally {
			metricLoading = false;
		}
	}

	// Update metric
	async function updateMetric(id: number, name: string, isActive: boolean, emoji?: string, nameNl?: string) {
		metricLoading = true;

		try {
			const res = await fetch(`${base}/api/metrics`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, name, isActive, emoji, name_nl: nameNl || null })
			});

			if (res.ok) {
				editingMetricId = null;
				await invalidateAll();
			}
		} finally {
			metricLoading = false;
		}
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

		try {
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

			await invalidateAll();
		} finally {
			goalLoading = false;
		}
	}

	// Countries management
	let countryLoading = $state(false);
	let selectedPersonForCountry = $state<number | null>(null);
	let countrySearch = $state('');
	let selectedCountryInitial = $state('ALL');

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

	const availableCountriesMap = $derived.by(() => {
		const map = new Map<string, { code: string; name: string; flag: string }>();
		for (const country of data.availableCountries || []) {
			map.set(country.code, country);
		}
		return map;
	});

	const filteredCountries = $derived.by(() => {
		const query = countrySearch.trim().toLowerCase();
		const initial = selectedCountryInitial;
		return (data.availableCountries || []).filter((country) => {
			const matchesSearch = !query || country.name.toLowerCase().includes(query) || country.code.toLowerCase().includes(query);
			const matchesInitial = initial === 'ALL' || country.name.toUpperCase().startsWith(initial);
			return matchesSearch && matchesInitial;
		});
	});

	const countryInitials = $derived.by(() => {
		const initials = new Set<string>();
		for (const country of data.availableCountries || []) {
			const first = country.name.trim().charAt(0).toUpperCase();
			if (/^[A-Z]$/.test(first)) {
				initials.add(first);
			}
		}
		return Array.from(initials).sort((a, b) => a.localeCompare(b));
	});

	$effect(() => {
		if (!countrySearch.trim() && selectedCountryInitial !== 'ALL') {
			selectedCountryInitial = 'ALL';
		}
	});

	const personVisitsMap = $derived.by(() => {
		const map = new Map<number, { country_code: string; country_name: string }[]>();
		for (const visit of data.countriesVisited || []) {
			if (!map.has(visit.person_id)) {
				map.set(visit.person_id, []);
			}
			map.get(visit.person_id)!.push({ country_code: visit.country_code, country_name: visit.country_name });
		}

		for (const [personId, visits] of map.entries()) {
			visits.sort((a, b) => a.country_name.localeCompare(b.country_name));
			map.set(personId, visits);
		}

		return map;
	});

	function codeToFlagEmoji(code: string): string {
		if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
		const A = 0x1f1e6;
		const chars = [...code].map((char) => String.fromCodePoint(A + char.charCodeAt(0) - 65));
		return chars.join('');
	}

	function getCountryDisplay(countryCode: string, fallbackName?: string): { code: string; name: string; flag: string } {
		const country = availableCountriesMap.get(countryCode.toUpperCase());
		if (country) return country;
		return {
			code: countryCode.toUpperCase(),
			name: fallbackName || countryCode,
			flag: codeToFlagEmoji(countryCode.toUpperCase())
		};
	}

	function getPersonVisitedCountries(personId: number): { country_code: string; country_name: string }[] {
		return personVisitsMap.get(personId) || [];
	}

	function hasVisitedCountry(personId: number, countryCode: string): boolean {
		return countriesMap.get(personId)?.has(countryCode) || false;
	}

	function getPersonCountryCount(personId: number): number {
		return countriesMap.get(personId)?.size || 0;
	}

	async function toggleCountry(personId: number, countryCode: string, countryName: string) {
		countryLoading = true;

		try {
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

			await invalidateAll();
		} finally {
			countryLoading = false;
		}
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
								<div>
									<p class="text-xs font-medium text-gray-600 mb-2">Visited countries</p>
									<div class="flex flex-wrap gap-2">
										{#each getPersonVisitedCountries(person.id) as visit}
											{@const country = getCountryDisplay(visit.country_code, visit.country_name)}
											<button
												onclick={() => toggleCountry(person.id, country.code, country.name)}
												disabled={countryLoading}
												class="px-2 py-1 text-sm rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition-colors"
												title="Remove {country.name}"
											>
												{country.flag} {country.code} ✕
											</button>
										{/each}
										{#if getPersonVisitedCountries(person.id).length === 0}
											<span class="text-sm text-gray-400">No countries recorded yet</span>
										{/if}
									</div>
								</div>
								
								<div class="pt-2 border-t">
									<p class="text-xs font-medium text-gray-600 mb-2">All countries</p>
									<div class="flex flex-wrap gap-1 mb-2">
										<button
											onclick={() => selectedCountryInitial = 'ALL'}
											class="px-2 py-1 text-xs rounded-md transition-colors {selectedCountryInitial === 'ALL' ? 'bg-teal-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}"
											disabled={countryLoading}
										>
											All
										</button>
										{#each countryInitials as initial}
											<button
												onclick={() => selectedCountryInitial = initial}
												class="w-7 h-7 text-xs rounded-md transition-colors {selectedCountryInitial === initial ? 'bg-teal-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}"
												disabled={countryLoading}
											>
												{initial}
											</button>
										{/each}
									</div>
									<input
										type="text"
										bind:value={countrySearch}
										placeholder="Search country by name or code..."
										class="w-full px-3 py-2 text-sm border rounded-lg focus:border-teal-500 focus:outline-none mb-2"
										disabled={countryLoading}
									/>
									<div class="max-h-56 overflow-y-auto border rounded-lg bg-white p-2">
										<div class="flex flex-wrap gap-2">
											{#each filteredCountries as country}
												<button
													onclick={() => toggleCountry(person.id, country.code, country.name)}
													disabled={countryLoading}
													class="px-2 py-1 text-sm rounded-lg transition-colors {hasVisitedCountry(person.id, country.code) ? 'bg-teal-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}"
													title={country.name}
												>
													{country.flag} {country.code}
												</button>
											{/each}
										</div>
										{#if filteredCountries.length === 0}
											<div class="text-sm text-gray-400 p-2">No matching countries.</div>
										{/if}
									</div>
								</div>
							</div>
						{:else}
							<!-- Show visited countries summary -->
							<div class="flex flex-wrap gap-1">
								{#each getPersonVisitedCountries(person.id) as visit}
									{@const country = getCountryDisplay(visit.country_code, visit.country_name)}
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
