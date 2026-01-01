<script lang="ts">
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { COUNTRIES, getSortedCountries, getCountry } from '$lib/countries';
	import { getRank, getMedal } from '$lib/ranking';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let countryLoading = $state(false);
	let selectedPerson = $state<number | null>(null);
	let countrySearch = $state('');
	let mapContainer: HTMLDivElement | null = $state(null);
	let map: any = $state(null);

	// Filtered countries for selection based on search
	const filteredCountries = $derived.by(() => {
		const all = getSortedCountries();
		if (!countrySearch.trim()) return all;
		const query = countrySearch.toLowerCase();
		return all.filter(c => 
			c.name.toLowerCase().includes(query) || 
			c.code.toLowerCase().includes(query)
		);
	});

	// Get all visited countries from the data
	const visitedCountries = $derived.by(() => {
		const countries = new Map<string, { code: string; name: string; visitors: string[] }>();
		for (const visit of data.countriesVisited || []) {
			if (!countries.has(visit.country_code)) {
				countries.set(visit.country_code, { 
					code: visit.country_code, 
					name: visit.country_name,
					visitors: [] 
				});
			}
			countries.get(visit.country_code)!.visitors.push(`${visit.person_emoji} ${visit.person_name}`);
		}
		return countries;
	});

	// Get unique countries count
	const uniqueCountriesCount = $derived(visitedCountries.size);

	// Get heat color based on visitor count
	function getHeatColor(visitorCount: number): string {
		if (visitorCount >= 5) return '#ef4444'; // red-500
		if (visitorCount >= 4) return '#f97316'; // orange-500
		if (visitorCount >= 3) return '#eab308'; // yellow-500
		if (visitorCount >= 2) return '#22c55e'; // green-500
		return '#14b8a6'; // teal-500
	}

	// Get dot size based on visitor count
	function getDotSize(visitorCount: number): number {
		return Math.min(8 + visitorCount * 2, 20);
	}

	// Store for Leaflet module and markers layer
	let leafletModule: typeof import('leaflet') | null = null;
	let markersLayer: any = null;

	// Initialize Leaflet map
	onMount(async () => {
		if (!browser || !mapContainer) return;
		
		leafletModule = await import('leaflet');
		const L = leafletModule;
		
		// Create map centered on world view
		map = L.map(mapContainer, {
			center: [20, 0],
			zoom: 2,
			minZoom: 1,
			maxZoom: 6,
			worldCopyJump: true
		});
		
		// Add OpenStreetMap tile layer
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap contributors',
			noWrap: false
		}).addTo(map);
		
		// Create a layer group for markers
		markersLayer = L.layerGroup().addTo(map);
	});
	
	// Update markers when visitedCountries changes
	$effect(() => {
		if (!map || !leafletModule || !markersLayer) return;
		
		const L = leafletModule;
		const countries = visitedCountries;
		
		// Clear existing markers
		markersLayer.clearLayers();
		
		// Add markers for visited countries
		for (const [code, countryInfo] of Object.entries(COUNTRIES)) {
			const visited = countries.get(code);
			if (visited) {
				const visitorCount = visited.visitors.length;
				const color = getHeatColor(visitorCount);
				const radius = getDotSize(visitorCount);
				
				const marker = L.circleMarker([countryInfo.lat, countryInfo.lng], {
					radius: radius,
					fillColor: color,
					color: '#fff',
					weight: 2,
					opacity: 1,
					fillOpacity: 0.9
				});
				
				// Add popup with visitor info - styled nicely
				const visitorsList = visited.visitors.map(v => `<div style="padding: 2px 0;">${v}</div>`).join('');
				marker.bindPopup(`
					<div style="min-width: 140px; padding: 4px;">
						<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">
							<span style="font-size: 32px; line-height: 1;">${countryInfo.flag}</span>
							<div>
								<div style="font-weight: 600; font-size: 14px; color: #1f2937;">${countryInfo.name}</div>
								<div style="font-size: 11px; color: #6b7280;">${visitorCount} visitor${visitorCount !== 1 ? 's' : ''}</div>
							</div>
						</div>
						<div style="font-size: 12px; color: #374151;">
							${visitorsList}
						</div>
					</div>
				`, { className: 'custom-popup' });
				
				markersLayer.addLayer(marker);
			}
		}
	});
	
	// Cleanup on unmount
	$effect(() => {
		return () => {
			if (map) {
				map.remove();
			}
		};
	});

	async function toggleCountry(personId: number, countryCode: string, countryName: string, isVisited: boolean) {
		countryLoading = true;
		
		if (isVisited) {
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

	function hasVisitedCountry(personId: number, countryCode: string): boolean {
		return (data.countriesVisited || []).some(
			(v: { person_id: number; country_code: string }) => v.person_id === personId && v.country_code === countryCode
		);
	}
</script>

<svelte:head>
	<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="bg-white rounded-2xl shadow-lg p-6">
		<h1 class="text-2xl font-bold text-gray-800">🌍 Countries Visited</h1>
		<p class="text-gray-500 mt-1">Track your travels and see who visited the most countries!</p>
	</div>

	{#if !data.authorized}
		<div class="bg-white rounded-xl shadow-lg p-8 text-center">
			<div class="text-6xl mb-4">🔒</div>
			<p class="text-gray-500">Please log in to view countries</p>
		</div>
	{:else if !data.season}
		<div class="bg-white rounded-xl shadow-lg p-8 text-center">
			<div class="text-6xl mb-4">📭</div>
			<p class="text-gray-500">No active season found</p>
		</div>
	{:else}
		<!-- Stats Overview -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
			<div class="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white">
				<div class="text-3xl font-bold">{uniqueCountriesCount}</div>
				<div class="text-teal-100 text-sm">Unique Countries</div>
			</div>
			{#each (data.countriesStats || []).slice(0, 3) as stat, i}
				<div class="bg-white rounded-xl shadow p-4">
					<div class="flex items-center gap-2">
						<span class="text-2xl">{stat.person_emoji}</span>
						<div>
							<div class="font-bold text-gray-800">{stat.country_count}</div>
							<div class="text-xs text-gray-500">{stat.person_name}</div>
						</div>
						{#if i === 0}
							<span class="ml-auto text-xl">🏆</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- World Map Heatmap -->
		<div class="bg-white rounded-xl shadow-lg overflow-hidden">
			<div class="bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-3">
				<h2 class="font-semibold text-white">🗺️ World Travel Map</h2>
			</div>
			
			<div class="p-4">
				<div class="relative rounded-xl overflow-hidden border-2 border-blue-200">
					<!-- Leaflet Map Container -->
					<div bind:this={mapContainer} style="height: 400px; width: 100%;"></div>
				</div>
				
				<!-- Legend -->
				<div class="flex items-center justify-center gap-4 mt-4 text-sm">
					<div class="flex items-center gap-1">
						<div class="w-3 h-3 rounded-full bg-teal-500"></div>
						<span class="text-gray-600">1 person</span>
					</div>
					<div class="flex items-center gap-1">
						<div class="w-3 h-3 rounded-full bg-green-500"></div>
						<span class="text-gray-600">2 people</span>
					</div>
					<div class="flex items-center gap-1">
						<div class="w-3 h-3 rounded-full bg-yellow-500"></div>
						<span class="text-gray-600">3 people</span>
					</div>
					<div class="flex items-center gap-1">
						<div class="w-3 h-3 rounded-full bg-orange-500"></div>
						<span class="text-gray-600">4 people</span>
					</div>
					<div class="flex items-center gap-1">
						<div class="w-3 h-3 rounded-full bg-red-500"></div>
						<span class="text-gray-600">5+ people</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Leaderboard -->
		<div class="bg-white rounded-xl shadow-lg overflow-hidden">
			<div class="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
				<h2 class="font-semibold text-white">🏆 Travel Leaderboard</h2>
			</div>
			
			<div class="divide-y">
				{#each data.countriesStats || [] as stat, i}
					{@const rank = getRank(i, data.countriesStats || [], (s: { country_count: number }) => s.country_count)}
					{@const medal = getMedal(rank)}
					<div class="p-4 flex items-center gap-4 {rank === 1 ? 'bg-amber-50' : ''}">
						<div class="text-2xl font-bold text-gray-300 w-8">#{rank}</div>
						<span class="text-3xl">{stat.person_emoji}</span>
						<div class="flex-1">
							<div class="font-semibold text-gray-800">{stat.person_name}</div>
							<div class="text-sm text-gray-500">
								{stat.countries.slice(0, 5).join(', ')}
								{#if stat.countries.length > 5}
									<span class="text-gray-400">+{stat.countries.length - 5} more</span>
								{/if}
							</div>
						</div>
						<div class="text-right">
							<div class="text-2xl font-bold text-teal-600">{stat.country_count}</div>
							<div class="text-xs text-gray-500">countries</div>
						</div>
						{#if medal}
							<span class="text-3xl">{medal}</span>
						{/if}
					</div>
				{:else}
					<div class="p-8 text-center text-gray-400">
						No countries recorded yet. Add some below!
					</div>
				{/each}
			</div>
		</div>

		<!-- Add Countries Section -->
		<div class="bg-white rounded-xl shadow-lg overflow-hidden">
			<div class="bg-teal-50 px-4 py-3 border-b">
				<h2 class="font-semibold text-teal-800">✏️ Manage Countries</h2>
				<p class="text-sm text-teal-600 mt-1">Click on a person to add or remove countries</p>
			</div>
			
			<div class="p-4 space-y-4">
				<!-- Person selector -->
				<div class="flex flex-wrap gap-2">
					{#each data.people || [] as person}
						{@const personCountryCount = (data.countriesVisited || []).filter((v: { person_id: number }) => v.person_id === person.id).length}
						<button
							onclick={() => selectedPerson = selectedPerson === person.id ? null : person.id}
							class="px-4 py-2 rounded-lg flex items-center gap-2 transition-all {selectedPerson === person.id ? 'bg-teal-500 text-white shadow-lg scale-105' : 'bg-gray-100 hover:bg-gray-200'}"
						>
							<span class="text-xl">{person.emoji}</span>
							<span>{person.name}</span>
							<span class="text-xs px-2 py-0.5 rounded-full {selectedPerson === person.id ? 'bg-teal-600' : 'bg-gray-200'}">
								{personCountryCount}
							</span>
						</button>
					{/each}
				</div>
				
				{#if selectedPerson}
					{@const person = (data.people || []).find((p: { id: number }) => p.id === selectedPerson)}
					{#if person}
						<div class="bg-gray-50 rounded-lg p-4 space-y-4">
							<h3 class="font-medium text-gray-700">
								Countries for {person.emoji} {person.name}
							</h3>
							
							<!-- Search countries -->
							<div class="relative">
								<input
									type="text"
									bind:value={countrySearch}
									placeholder="🔍 Search countries..."
									class="w-full px-4 py-2 border rounded-lg focus:border-teal-500 focus:outline-none"
									disabled={countryLoading}
								/>
								{#if countrySearch}
									<button
										onclick={() => countrySearch = ''}
										class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
									>
										✕
									</button>
								{/if}
							</div>
							
							<!-- Country grid -->
							<div class="max-h-80 overflow-y-auto rounded-lg border bg-white">
								<div class="flex flex-wrap gap-2 p-3">
									{#each filteredCountries as country}
										{@const isVisited = hasVisitedCountry(person.id, country.code)}
										<button
											onclick={() => toggleCountry(person.id, country.code, country.name, isVisited)}
											disabled={countryLoading}
											class="px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 {isVisited ? 'bg-teal-500 text-white shadow' : 'bg-gray-100 hover:bg-gray-200'}"
										>
											<span>{country.flag}</span>
											<span>{country.name}</span>
											{#if isVisited}
												<span class="ml-1">✓</span>
											{/if}
										</button>
									{/each}
									{#if filteredCountries.length === 0}
										<p class="text-gray-400 text-sm p-2">No countries found matching "{countrySearch}"</p>
									{/if}
								</div>
							</div>
							
							<p class="text-xs text-gray-500">
								Showing {filteredCountries.length} of {getSortedCountries().length} countries
							</p>
						</div>
					{/if}
				{/if}
			</div>
		</div>

		<div class="bg-teal-50 border border-teal-200 rounded-xl p-4 text-teal-800 text-sm">
			<strong>💡 Tip:</strong> Don't forget to include the Netherlands 🇳🇱 as your home country! The most traveled person will be revealed in the New Year's quiz.
		</div>
	{/if}
</div>

<style>
	/* Ensure Leaflet map controls don't overlap navbar */
	:global(.leaflet-container) {
		z-index: 0 !important;
	}
	:global(.leaflet-pane) {
		z-index: 0 !important;
	}
	:global(.leaflet-top),
	:global(.leaflet-bottom) {
		z-index: 10 !important;
	}
	:global(.leaflet-control) {
		z-index: 10 !important;
	}
	:global(.leaflet-popup) {
		z-index: 20 !important;
	}
</style>
