<script lang="ts">
	import type { PageData } from './$types';
	import { invalidateAll, goto } from '$app/navigation';
	import { base } from '$app/paths';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let newYear = $state(new Date().getFullYear() + 1);
	let newName = $state(`Season ${new Date().getFullYear() + 1}`);
	let loading = $state(false);
	let error = $state('');

	// PIN management state
	let newTrackerPin = $state('');
	let newAdminPin = $state('');
	let pinError = $state('');
	let pinSuccess = $state('');
	let showPinSection = $state(false);

	async function createSeason() {
		if (!newYear || !newName.trim()) return;
		loading = true;
		error = '';

		try {
			const res = await fetch(`${base}/api/seasons`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ year: newYear, name: newName.trim() })
			});

			if (!res.ok) {
				const data = await res.json();
				error = data.error || 'Failed to create season';
			} else {
				newYear = new Date().getFullYear() + 1;
				newName = `Season ${new Date().getFullYear() + 1}`;
				await invalidateAll();
			}
		} catch {
			error = 'Connection error';
		} finally {
			loading = false;
		}
	}

	async function setActiveSeason(id: number) {
		loading = true;
		
		await fetch(`${base}/api/seasons`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		
		loading = false;
		await invalidateAll();
	}

	async function changePin(type: 'tracker' | 'admin') {
		const newPin = type === 'tracker' ? newTrackerPin : newAdminPin;
		
		if (!newPin || newPin.length < 4) {
			pinError = 'PIN must be at least 4 characters';
			return;
		}

		loading = true;
		pinError = '';
		pinSuccess = '';

		try {
			const res = await fetch(`${base}/api/pins`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type, newPin })
			});

			const data = await res.json();
			
			if (!res.ok) {
				pinError = data.error || 'Failed to change PIN';
			} else {
				pinSuccess = data.message;
				if (type === 'tracker') {
					newTrackerPin = '';
				} else {
					newAdminPin = '';
					// Admin PIN changed - redirect to login
					if (data.logout) {
						setTimeout(() => goto(`${base}/`), 2000);
					}
				}
			}
		} catch {
			pinError = 'Connection error';
		} finally {
			loading = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="bg-white rounded-2xl shadow-lg p-6">
		<h1 class="text-2xl font-bold text-gray-800">📅 Season Management</h1>
		<p class="text-gray-500 mt-1">Admin-only: Switch seasons and create new ones</p>
	</div>

	<!-- Current Season -->
	{#if data.activeSeason}
		<div class="bg-green-50 border border-green-200 rounded-xl p-4">
			<div class="flex items-center gap-2">
				<span class="text-green-600 text-xl">✓</span>
				<div>
					<div class="font-semibold text-green-800">Active Season</div>
					<div class="text-green-700">{data.activeSeason.name} ({data.activeSeason.year})</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800">
			No active season selected. Please activate one below.
		</div>
	{/if}

	<!-- All Seasons -->
	<div class="bg-white rounded-xl shadow-lg overflow-hidden">
		<div class="bg-gray-50 px-4 py-3 border-b">
			<h2 class="font-semibold text-gray-700">All Seasons</h2>
		</div>
		
		<div class="divide-y">
			{#each data.seasons || [] as season}
				<div class="px-4 py-3 flex items-center justify-between">
					<div>
						<div class="font-medium text-gray-800">{season.name}</div>
						<div class="text-sm text-gray-500">Year: {season.year}</div>
					</div>
					<div class="flex items-center gap-2">
						{#if season.is_active}
							<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
								Active
							</span>
						{:else}
							<button
								onclick={() => setActiveSeason(season.id)}
								disabled={loading}
								class="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm hover:bg-indigo-200 disabled:opacity-50 transition-colors"
							>
								Set Active
							</button>
						{/if}
					</div>
				</div>
			{/each}

			{#if !data.seasons?.length}
				<div class="px-4 py-8 text-center text-gray-500">
					No seasons yet. Create one below.
				</div>
			{/if}
		</div>
	</div>

	<!-- Create New Season -->
	<div class="bg-white rounded-xl shadow-lg overflow-hidden">
		<div class="bg-indigo-50 px-4 py-3 border-b">
			<h2 class="font-semibold text-indigo-800">➕ Create New Season</h2>
		</div>
		
		<form onsubmit={(e) => { e.preventDefault(); createSeason(); }} class="p-4 space-y-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<label for="year" class="block text-sm font-medium text-gray-700 mb-1">Year</label>
					<input
						type="number"
						id="year"
						bind:value={newYear}
						min="2020"
						max="2100"
						class="w-full px-3 py-2 border rounded-lg focus:border-indigo-500 focus:outline-none"
						disabled={loading}
					/>
				</div>
				<div>
					<label for="name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
					<input
						type="text"
						id="name"
						bind:value={newName}
						placeholder="Season 2027"
						class="w-full px-3 py-2 border rounded-lg focus:border-indigo-500 focus:outline-none"
						disabled={loading}
					/>
				</div>
			</div>

			{#if error}
				<div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
					{error}
				</div>
			{/if}

			<button
				type="submit"
				disabled={loading || !newName.trim()}
				class="w-full py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
			>
				{loading ? 'Creating...' : 'Create Season'}
			</button>
		</form>
	</div>

	<div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-sm">
		<strong>ℹ️ Note:</strong> Each year's tracker will use the active season. Switching seasons allows future trackers to manage their own year's data.
	</div>

	<!-- PIN Management -->
	<div class="bg-white rounded-xl shadow-lg overflow-hidden">
		<button
			onclick={() => showPinSection = !showPinSection}
			class="w-full bg-gray-50 px-4 py-3 border-b flex items-center justify-between hover:bg-gray-100 transition-colors"
		>
			<h2 class="font-semibold text-gray-700">🔐 PIN Management</h2>
			<span class="text-gray-400">{showPinSection ? '▲' : '▼'}</span>
		</button>
		
		{#if showPinSection}
			<div class="p-4 space-y-4">
				{#if pinError}
					<div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
						{pinError}
					</div>
				{/if}
				
				{#if pinSuccess}
					<div class="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
						{pinSuccess}
					</div>
				{/if}

				<!-- Change Tracker PIN -->
				<div class="p-4 bg-indigo-50 rounded-lg">
					<h3 class="font-medium text-indigo-800 mb-2">Change Tracker PIN</h3>
					<p class="text-sm text-indigo-600 mb-3">
						Use this when handing off tracking duties to someone else. The old tracker will no longer be able to access the tracker interface.
					</p>
					<div class="flex gap-2">
						<input
							type="password"
							bind:value={newTrackerPin}
							placeholder="New Tracker PIN (min 4 chars)"
							class="flex-1 px-3 py-2 border rounded-lg focus:border-indigo-500 focus:outline-none"
							disabled={loading}
						/>
						<button
							onclick={() => changePin('tracker')}
							disabled={loading || newTrackerPin.length < 4}
							class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
						>
							Update
						</button>
					</div>
				</div>

				<!-- Change Admin PIN -->
				<div class="p-4 bg-amber-50 rounded-lg">
					<h3 class="font-medium text-amber-800 mb-2">Change Admin PIN</h3>
					<p class="text-sm text-amber-600 mb-3">
						⚠️ You will be logged out and need to log in with the new PIN.
					</p>
					<div class="flex gap-2">
						<input
							type="password"
							bind:value={newAdminPin}
							placeholder="New Admin PIN (min 4 chars)"
							class="flex-1 px-3 py-2 border rounded-lg focus:border-amber-500 focus:outline-none"
							disabled={loading}
						/>
						<button
							onclick={() => changePin('admin')}
							disabled={loading || newAdminPin.length < 4}
							class="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
						>
							Update
						</button>
					</div>
				</div>

				<div class="text-sm text-gray-500">
					<strong>Handoff process:</strong>
					<ol class="list-decimal list-inside mt-1 space-y-1">
						<li>Change the Tracker PIN here</li>
						<li>Share the new PIN with the new tracker only</li>
						<li>The old tracker's access is immediately revoked</li>
					</ol>
				</div>
			</div>
		{/if}
	</div>
</div>
