<script lang="ts">
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { base } from '$app/paths';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let selectedIds = $state<Set<number>>(new Set());
	let selectedDeletedIds = $state<Set<number>>(new Set());
	let loading = $state(false);
	let editingEntry = $state<{ id: number; personId: number; metricId: number; entryDate: string } | null>(null);
	let activeTab = $state<'active' | 'deleted' | 'audit'>('active');

	function toggleSelection(id: number) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function toggleDeletedSelection(id: number) {
		const newSet = new Set(selectedDeletedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedDeletedIds = newSet;
	}

	function toggleAll() {
		if (selectedIds.size === (data.entries?.length || 0)) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(data.entries?.map((e: { id: number }) => e.id) || []);
		}
	}

	function toggleAllDeleted() {
		if (selectedDeletedIds.size === (data.deletedEntries?.length || 0)) {
			selectedDeletedIds = new Set();
		} else {
			selectedDeletedIds = new Set(data.deletedEntries?.map((e: { id: number }) => e.id) || []);
		}
	}

	async function deleteSelected() {
		if (selectedIds.size === 0) return;
		if (!confirm(`Delete ${selectedIds.size} entries? They can be restored later.`)) return;

		loading = true;
		
		await fetch(`${base}/api/entries`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids: Array.from(selectedIds) })
		});
		
		selectedIds = new Set();
		loading = false;
		await invalidateAll();
	}

	async function undeleteSelected() {
		if (selectedDeletedIds.size === 0) return;

		loading = true;
		
		await fetch(`${base}/api/entries`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids: Array.from(selectedDeletedIds), action: 'undelete' })
		});
		
		selectedDeletedIds = new Set();
		loading = false;
		await invalidateAll();
	}

	async function deleteOne(id: number) {
		if (!confirm('Delete this entry? It can be restored later.')) return;

		loading = true;
		
		await fetch(`${base}/api/entries`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		
		loading = false;
		await invalidateAll();
	}

	async function undeleteOne(id: number) {
		loading = true;
		
		await fetch(`${base}/api/entries`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, action: 'undelete' })
		});
		
		loading = false;
		await invalidateAll();
	}

	function startEdit(entry: { id: number; person_id: number; metric_id: number; entry_date: string }) {
		editingEntry = {
			id: entry.id,
			personId: entry.person_id,
			metricId: entry.metric_id,
			entryDate: entry.entry_date
		};
	}

	async function saveEdit() {
		if (!editingEntry) return;

		loading = true;
		
		await fetch(`${base}/api/entries`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(editingEntry)
		});
		
		editingEntry = null;
		loading = false;
		await invalidateAll();
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function formatDateTime(dateStr: string): string {
		return new Date(dateStr).toLocaleString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getActionIcon(action: string): string {
		switch (action) {
			case 'create': return '➕';
			case 'update': return '✏️';
			case 'delete': return '🗑️';
			case 'undelete': return '♻️';
			default: return '📝';
		}
	}

	function getActionColor(action: string): string {
		switch (action) {
			case 'create': return 'text-green-600 bg-green-50';
			case 'update': return 'text-blue-600 bg-blue-50';
			case 'delete': return 'text-red-600 bg-red-50';
			case 'undelete': return 'text-purple-600 bg-purple-50';
			default: return 'text-gray-600 bg-gray-50';
		}
	}
</script>

<div class="space-y-6">
	<div class="bg-white rounded-2xl shadow-lg p-6">
		<h1 class="text-2xl font-bold text-gray-800">📝 Entry Management</h1>
		<p class="text-gray-500 mt-1">Admin-only: Manage entries with full audit history (notes hidden)</p>
	</div>

	{#if !data.season}
		<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800">
			No active season. Go to Seasons to set one up.
		</div>
	{:else}
		<!-- Tabs -->
		<div class="flex gap-2 bg-white rounded-xl shadow p-2">
			<button
				onclick={() => activeTab = 'active'}
				class="flex-1 py-2 px-4 rounded-lg font-medium transition-colors {activeTab === 'active' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}"
			>
				Active ({data.entries?.length || 0})
			</button>
			<button
				onclick={() => activeTab = 'deleted'}
				class="flex-1 py-2 px-4 rounded-lg font-medium transition-colors {activeTab === 'deleted' ? 'bg-red-100 text-red-700' : 'text-gray-600 hover:bg-gray-100'}"
			>
				🗑️ Deleted ({data.deletedEntries?.length || 0})
			</button>
			<button
				onclick={() => activeTab = 'audit'}
				class="flex-1 py-2 px-4 rounded-lg font-medium transition-colors {activeTab === 'audit' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}"
			>
				📜 Audit Log
			</button>
		</div>

		<!-- Bulk actions for active -->
		{#if activeTab === 'active' && selectedIds.size > 0}
			<div class="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
				<span class="text-red-800">
					{selectedIds.size} entries selected
				</span>
				<button
					onclick={deleteSelected}
					disabled={loading}
					class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
				>
					🗑️ Delete Selected
				</button>
			</div>
		{/if}

		<!-- Bulk actions for deleted -->
		{#if activeTab === 'deleted' && selectedDeletedIds.size > 0}
			<div class="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
				<span class="text-green-800">
					{selectedDeletedIds.size} deleted entries selected
				</span>
				<button
					onclick={undeleteSelected}
					disabled={loading}
					class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
				>
					♻️ Restore Selected
				</button>
			</div>
		{/if}

		<!-- Edit modal -->
		{#if editingEntry}
			<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
				<div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
					<h2 class="text-lg font-bold text-gray-800 mb-4">Edit Entry</h2>
					
					<div class="space-y-4">
						<div>
							<label for="editPerson" class="block text-sm font-medium text-gray-700 mb-1">Person</label>
							<select
								id="editPerson"
								bind:value={editingEntry.personId}
								class="w-full px-3 py-2 border rounded-lg focus:border-indigo-500 focus:outline-none"
							>
								{#each data.people || [] as person}
									<option value={person.id}>{person.name}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="editMetric" class="block text-sm font-medium text-gray-700 mb-1">Metric</label>
							<select
								id="editMetric"
								bind:value={editingEntry.metricId}
								class="w-full px-3 py-2 border rounded-lg focus:border-indigo-500 focus:outline-none"
							>
								{#each data.metrics || [] as metric}
									<option value={metric.id}>{metric.name}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="editDate" class="block text-sm font-medium text-gray-700 mb-1">Date</label>
							<input
								type="date"
								id="editDate"
								bind:value={editingEntry.entryDate}
								class="w-full px-3 py-2 border rounded-lg focus:border-indigo-500 focus:outline-none"
							/>
						</div>
					</div>

					<div class="flex gap-3 mt-6">
						<button
							onclick={() => editingEntry = null}
							class="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
						>
							Cancel
						</button>
						<button
							onclick={saveEdit}
							disabled={loading}
							class="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
						>
							Save
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Active entries table -->
		{#if activeTab === 'active'}
			<div class="bg-white rounded-xl shadow-lg overflow-hidden">
				<div class="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
					<h2 class="font-semibold text-gray-700">
						{data.season.name} - {data.entries?.length || 0} active entries
					</h2>
				</div>
				
				{#if !data.entries?.length}
					<div class="px-4 py-8 text-center text-gray-500">
						No active entries.
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-3 py-2 text-left">
										<input
											type="checkbox"
											checked={selectedIds.size === data.entries.length}
											onchange={toggleAll}
											class="rounded"
										/>
									</th>
									<th class="px-3 py-2 text-left text-gray-700">ID</th>
									<th class="px-3 py-2 text-left text-gray-700">Date</th>
									<th class="px-3 py-2 text-left text-gray-700">Person</th>
									<th class="px-3 py-2 text-left text-gray-700">Metric</th>
									<th class="px-3 py-2 text-right text-gray-700">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{#each data.entries as entry}
									<tr class="hover:bg-gray-50 {selectedIds.has(entry.id) ? 'bg-indigo-50' : ''}">
										<td class="px-3 py-2">
											<input
												type="checkbox"
												checked={selectedIds.has(entry.id)}
												onchange={() => toggleSelection(entry.id)}
												class="rounded"
											/>
										</td>
										<td class="px-3 py-2 text-gray-500">#{entry.id}</td>
										<td class="px-3 py-2 text-gray-800">{formatDate(entry.entry_date)}</td>
										<td class="px-3 py-2 text-gray-800">{entry.person_name}</td>
										<td class="px-3 py-2 text-gray-800">{entry.metric_name}</td>
										<td class="px-3 py-2 text-right">
											<button
												onclick={() => startEdit(entry)}
												class="px-2 py-1 text-indigo-600 hover:bg-indigo-100 rounded text-xs"
											>
												Edit
											</button>
											<button
												onclick={() => deleteOne(entry.id)}
												class="px-2 py-1 text-red-600 hover:bg-red-100 rounded text-xs ml-1"
											>
												Delete
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Deleted entries table -->
		{#if activeTab === 'deleted'}
			<div class="bg-white rounded-xl shadow-lg overflow-hidden">
				<div class="bg-red-50 px-4 py-3 border-b flex items-center justify-between">
					<h2 class="font-semibold text-red-700">
						🗑️ Deleted Entries - {data.deletedEntries?.length || 0} items
					</h2>
				</div>
				
				{#if !data.deletedEntries?.length}
					<div class="px-4 py-8 text-center text-gray-500">
						No deleted entries. Nothing in the trash.
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-3 py-2 text-left">
										<input
											type="checkbox"
											checked={selectedDeletedIds.size === data.deletedEntries.length}
											onchange={toggleAllDeleted}
											class="rounded"
										/>
									</th>
									<th class="px-3 py-2 text-left text-gray-700">ID</th>
									<th class="px-3 py-2 text-left text-gray-700">Date</th>
									<th class="px-3 py-2 text-left text-gray-700">Person</th>
									<th class="px-3 py-2 text-left text-gray-700">Metric</th>
									<th class="px-3 py-2 text-left text-gray-700">Deleted At</th>
									<th class="px-3 py-2 text-right text-gray-700">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{#each data.deletedEntries as entry}
									<tr class="hover:bg-gray-50 bg-red-50/30 {selectedDeletedIds.has(entry.id) ? 'bg-green-50' : ''}">
										<td class="px-3 py-2">
											<input
												type="checkbox"
												checked={selectedDeletedIds.has(entry.id)}
												onchange={() => toggleDeletedSelection(entry.id)}
												class="rounded"
											/>
										</td>
										<td class="px-3 py-2 text-gray-500">#{entry.id}</td>
										<td class="px-3 py-2 text-gray-600">{formatDate(entry.entry_date)}</td>
										<td class="px-3 py-2 text-gray-600">{entry.person_name}</td>
										<td class="px-3 py-2 text-gray-600">{entry.metric_name}</td>
										<td class="px-3 py-2 text-gray-400 text-xs">{entry.deleted_at ? formatDateTime(entry.deleted_at) : '-'}</td>
										<td class="px-3 py-2 text-right">
											<button
												onclick={() => undeleteOne(entry.id)}
												class="px-2 py-1 text-green-600 hover:bg-green-100 rounded text-xs"
											>
												♻️ Restore
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-sm">
				<strong>ℹ️ Note:</strong> Deleted entries are never permanently removed. They are soft-deleted and can always be restored. The audit log tracks all actions.
			</div>
		{/if}

		<!-- Audit log -->
		{#if activeTab === 'audit'}
			<div class="bg-white rounded-xl shadow-lg overflow-hidden">
				<div class="bg-purple-50 px-4 py-3 border-b">
					<h2 class="font-semibold text-purple-700">📜 Audit Log (Last 50 actions)</h2>
				</div>
				
				{#if !data.auditLogs?.length}
					<div class="px-4 py-8 text-center text-gray-500">
						No audit log entries yet.
					</div>
				{:else}
					<div class="divide-y">
						{#each data.auditLogs as log}
							<div class="px-4 py-3 flex items-start gap-3">
								<span class="text-lg">{getActionIcon(log.action)}</span>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<span class="px-2 py-0.5 rounded text-xs font-medium {getActionColor(log.action)}">
											{log.action.toUpperCase()}
										</span>
										<span class="text-sm text-gray-800">
											Entry #{log.entry_id}: {log.person_name} - {log.metric_name}
										</span>
									</div>
									<div class="text-xs text-gray-500 mt-1">
										{formatDateTime(log.performed_at)} by {log.performed_by}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="bg-purple-50 border border-purple-200 rounded-xl p-4 text-purple-800 text-sm">
				<strong>📝 Append-only:</strong> This audit log only accepts inserts - no records are ever deleted or modified. Every action (create, update, delete, undelete) is permanently recorded.
			</div>
		{/if}
	{/if}
</div>
