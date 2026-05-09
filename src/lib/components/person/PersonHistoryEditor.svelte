<script lang="ts">
	import type { Metric, Person, Season, EntryWithNames } from '$lib/server/db';
	import { base } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { locale, t } from '$lib/stores/locale';
	import type { Translations, Locale } from '$lib/i18n';
	import { translateMetric } from '$lib/i18n';

	interface Props {
		entries: EntryWithNames[];
		metrics: Metric[];
		person: Person;
		season: Season;
		role: 'tracker' | 'admin';
	}

	let { entries, metrics, person, season, role }: Props = $props();

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

	function getTranslatedMetricName(metric: string | { name: string; name_nl?: string | null }): string {
		if (typeof metric === 'string') {
			return translateMetric(metric, currentLocale);
		}
		return translateMetric(metric.name, currentLocale, metric.name_nl);
	}

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
		{ value: 'ice-skating', label: `⛸️ ${translations?.sports.iceSkating ?? 'Ice Skating'}` },
		{ value: 'road-skating', label: `🛼 ${translations?.sports.roadSkating ?? 'Road Skating'}` },
		{ value: 'snowboarding', label: `🏂 ${translations?.sports.snowboarding ?? 'Snowboarding'}` },
		{ value: 'sledding', label: `🛷 ${translations?.sports.sledding ?? 'Sledding'}` },
		{ value: 'physio', label: `🧑‍⚕️ ${translations?.sports.physio ?? 'Physio'}` },
		{ value: 'boxing', label: `🥊 ${translations?.sports.boxing ?? 'Boxing'}` },
		{ value: 'martial-arts', label: `🥋 ${translations?.sports.martialArts ?? 'Martial Arts'}` },
		{ value: 'dance', label: `💃 ${translations?.sports.dance ?? 'Dance'}` },
		{ value: 'hyrox', label: `🏆 ${translations?.sports.hyrox ?? 'Hyrox'}` },
		{ value: 'other', label: `🏅 ${translations?.sports.other ?? 'Other'}` }
	]);

	let historyFilterDate = $state('');
	let editingEntry = $state<{ id: number; metricId: number; entryDate: string; tag: string | null } | null>(null);
	let saveEditLoading = $state(false);
	let deleteEditLoading = $state(false);
	let saveEditError = $state('');

	function formatEntryDate(dateStr: string): string {
		const date = new Date(`${dateStr}T00:00:00`);
		if (Number.isNaN(date.getTime())) return dateStr;
		return date.toLocaleDateString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	function getEntryTags(tags: string | null | undefined): string[] {
		if (!tags) return [];

		const trimmed = tags.trim();
		if (!trimmed) return [];

		try {
			const parsed = JSON.parse(trimmed);
			if (Array.isArray(parsed)) {
				return parsed
					.map((value) => String(value).trim())
					.filter(Boolean);
			}
		} catch {
			// fallback to comma-separated parsing
		}

		return trimmed
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean);
	}

	function getSportTagLabel(tag: string): string {
		const raw = tag.trim().toLowerCase();
		const normalized =
			raw === 'skating' ? 'ice-skating' :
			raw === 'inline-skating' || raw === 'skeeleren' ? 'road-skating' :
			raw;
		const found = SPORT_ACTIVITIES.find((activity) => activity.value === normalized);
		if (found) return found.label;
		return normalized
			.split('-')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function isSportingMetricId(metricId: number): boolean {
		const metric = metrics.find((m) => m.id === metricId);
		return (metric?.name || '').toLowerCase() === 'sporting';
	}

	const sortedEntries = $derived.by(() => {
		return [...entries].sort((a, b) => {
			const dateCompare = b.entry_date.localeCompare(a.entry_date);
			if (dateCompare !== 0) return dateCompare;
			return b.id - a.id;
		});
	});

	const filteredEntries = $derived.by(() => {
		if (!historyFilterDate) return sortedEntries.slice(0, 25);
		return sortedEntries.filter((entry) => entry.entry_date === historyFilterDate);
	});

	function startEditEntry(entry: { id: number; metric_id: number; entry_date: string; tags?: string | null }): void {
		const existingTags = getEntryTags(entry.tags);
		editingEntry = {
			id: entry.id,
			metricId: entry.metric_id,
			entryDate: entry.entry_date,
			tag: existingTags[0] || null
		};
		saveEditError = '';
	}

	function toggleEditTag(tag: string): void {
		if (!editingEntry) return;
		editingEntry = {
			...editingEntry,
			tag: editingEntry.tag === tag ? null : tag
		};
	}

	function closeEditEntryModal(): void {
		editingEntry = null;
		saveEditError = '';
	}

	async function deleteEntryById(entryId: number): Promise<void> {
		if (!window.confirm('Delete this entry? This cannot be undone from this page.')) return;

		deleteEditLoading = true;
		saveEditError = '';

		try {
			const res = await fetch(`${base}/api/entries`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: entryId })
			});

			if (!res.ok) {
				saveEditError = 'Failed to delete entry. Please try again.';
				return;
			}

			if (editingEntry?.id === entryId) {
				closeEditEntryModal();
			}
			await invalidateAll();
		} catch {
			saveEditError = 'Failed to delete entry. Please try again.';
		} finally {
			deleteEditLoading = false;
		}
	}

	async function saveEntryEdit(): Promise<void> {
		if (!editingEntry) return;

		const entryYear = new Date(editingEntry.entryDate).getFullYear();
		if (entryYear !== season.year) {
			saveEditError = `Date must be within the ${season.year} season`;
			return;
		}

		const isSportingEntry = isSportingMetricId(editingEntry.metricId);
		if (isSportingEntry && !editingEntry.tag) {
			saveEditError = 'Please select one sporting activity.';
			return;
		}

		saveEditLoading = true;
		saveEditError = '';

		try {
			const res = await fetch(`${base}/api/entries`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: editingEntry.id,
					personId: person.id,
					metricId: editingEntry.metricId,
					entryDate: editingEntry.entryDate,
					tags: isSportingEntry ? editingEntry.tag : undefined
				})
			});

			if (!res.ok) {
				saveEditError = 'Failed to update entry. Please try again.';
				return;
			}

			closeEditEntryModal();
			await invalidateAll();
		} catch {
			saveEditError = 'Failed to update entry. Please try again.';
		} finally {
			saveEditLoading = false;
		}
	}
</script>

{#if role === 'tracker' || role === 'admin'}
<!-- Entry History Editor -->
<div class="bg-white rounded-xl shadow-lg p-4">
	<div class="flex items-center justify-between gap-3 mb-3">
		<h2 class="font-semibold text-gray-800">📝 Entry History</h2>
		<div class="flex items-center gap-2">
			<input
				type="date"
				bind:value={historyFilterDate}
				class="px-3 py-1.5 border rounded-lg text-sm"
			/>
			{#if historyFilterDate}
				<button
					onclick={() => historyFilterDate = ''}
					class="px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
				>
					Clear
				</button>
			{/if}
		</div>
	</div>

	{#if filteredEntries.length === 0}
		<div class="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
			No entries found for this date.
		</div>
	{:else}
		<div class="space-y-2 max-h-80 overflow-auto pr-1">
			{#each filteredEntries as entry}
				{@const metric = metrics.find((m) => m.id === entry.metric_id)}
				{@const entryTags = getEntryTags(entry.tags)}
				<div class="flex items-start justify-between gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
					<div class="min-w-0 flex-1">
						<div class="text-xs font-medium text-gray-500 mb-1">{formatEntryDate(entry.entry_date)}</div>
						<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 text-sm font-semibold max-w-full">
							<span>{metric?.emoji || '📊'}</span>
							<span class="truncate">{metric ? getTranslatedMetricName(metric) : entry.metric_name}</span>
						</div>
						{#if entryTags.length > 0}
							<div class="flex flex-wrap gap-1.5 mt-2">
								{#each entryTags as tag}
									<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{getSportTagLabel(tag)}</span>
								{/each}
							</div>
						{/if}
					</div>
					<div class="flex items-center gap-1.5 shrink-0">
						<button
							onclick={() => startEditEntry(entry)}
							class="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg transition-colors"
						>
							Edit
						</button>
						<button
							onclick={() => void deleteEntryById(entry.id)}
							class="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
							disabled={deleteEditLoading || saveEditLoading}
						>
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>
		{#if !historyFilterDate && sortedEntries.length > 25}
			<div class="text-xs text-gray-400 mt-2">
				Showing latest 25 entries. Use date filter to edit older entries.
			</div>
		{/if}
	{/if}
</div>

{#if editingEntry}
	{@const editMetricId = editingEntry?.metricId ?? -1}
	{@const editMetric = metrics.find((metric) => metric.id === editMetricId)}
	{@const isSportingEdit = isSportingMetricId(editMetricId)}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
			<h2 class="text-lg font-bold text-gray-800 mb-1">Edit Past Entry</h2>
			<p class="text-sm text-gray-500 mb-4">Update the date and, for sporting entries, the specific sport activity.</p>

			<div class="space-y-4">
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Metric Type</div>
					<div class="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 text-sm font-medium">
						{editMetric?.emoji || '📊'} {editMetric ? getTranslatedMetricName(editMetric) : 'Unknown'}
					</div>
					<div class="text-xs text-gray-500 mt-1">Metric type is fixed for this entry.</div>
				</div>

				{#if isSportingEdit}
					<div>
						<div class="block text-sm font-medium text-gray-700 mb-2">Sport Activity</div>
						<div class="flex flex-wrap gap-2">
							{#each SPORT_ACTIVITIES as activity}
								<button
									type="button"
									onclick={() => toggleEditTag(activity.value)}
									class="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors {editingEntry?.tag === activity.value ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}"
								>
									{activity.label}
								</button>
							{/each}
						</div>
						<div class="text-xs text-gray-500 mt-2">Each sporting activity must be logged as a separate entry.</div>
					</div>
				{/if}

				<div>
					<label for="editDate" class="block text-sm font-medium text-gray-700 mb-1">Date</label>
					<input
						id="editDate"
						type="date"
						bind:value={editingEntry.entryDate}
						class="w-full px-3 py-2 border rounded-lg focus:border-indigo-500 focus:outline-none"
					/>
				</div>

				{#if saveEditError}
					<div class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
						{saveEditError}
					</div>
				{/if}

				<div class="flex justify-end gap-2 pt-2">
					<button
						onclick={() => editingEntry && void deleteEntryById(editingEntry.id)}
						class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 mr-auto"
						disabled={saveEditLoading || deleteEditLoading}
					>
						{deleteEditLoading ? 'Deleting...' : 'Delete Entry'}
					</button>
					<button
						onclick={closeEditEntryModal}
						class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
						disabled={saveEditLoading || deleteEditLoading}
					>
						Cancel
					</button>
					<button
						onclick={saveEntryEdit}
						class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
						disabled={saveEditLoading || deleteEditLoading}
					>
						{saveEditLoading ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
{/if}
