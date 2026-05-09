<script lang="ts">
	import { SPORTS, findSport, LEGACY_SPORT_DISPLAY } from '$lib/sports';

	interface SportCount {
		tag: string;
		count: number;
	}

	interface Props {
		sportCounts: SportCount[];
		limit?: number;
	}

	let { sportCounts, limit }: Props = $props();

	const total = $derived(sportCounts.reduce((sum, s) => sum + s.count, 0));

	// Resolve display info for a tag
	function resolveSport(tag: string): { emoji: string; name: string; group: string } {
		const found = findSport(tag);
		if (found) return { emoji: found.emoji, name: found.englishLabel, group: found.group };
		const legacy = LEGACY_SPORT_DISPLAY[tag];
		if (legacy) return { emoji: legacy.emoji, name: legacy.englishLabel, group: 'Other' };
		return { emoji: '🏅', name: tag, group: 'Other' };
	}

	// Known group order
	const GROUP_ORDER = ['Cardio', 'Water', 'Gym & Fitness', 'Mind & Body', 'Racket', 'Team', 'Climbing', 'Winter', 'Combat', 'Other'];

	const grouped = $derived.by(() => {
		// Apply limit if set
		const counts = limit !== undefined ? [...sportCounts].sort((a, b) => b.count - a.count).slice(0, limit) : sportCounts;

		// Group by sport group
		const map = new Map<string, { tag: string; count: number; emoji: string; name: string }[]>();

		for (const sc of counts) {
			const info = resolveSport(sc.tag);
			if (!map.has(info.group)) map.set(info.group, []);
			map.get(info.group)!.push({ tag: sc.tag, count: sc.count, emoji: info.emoji, name: info.name });
		}

		// Sort within each group by count desc
		for (const items of map.values()) {
			items.sort((a, b) => b.count - a.count);
		}

		// Return in group order
		const result: { group: string; items: { tag: string; count: number; emoji: string; name: string }[] }[] = [];
		for (const group of GROUP_ORDER) {
			if (map.has(group)) {
				result.push({ group, items: map.get(group)! });
			}
		}
		// Any group not in GROUP_ORDER
		for (const [group, items] of map.entries()) {
			if (!GROUP_ORDER.includes(group)) {
				result.push({ group, items });
			}
		}
		return result;
	});

	const maxCount = $derived(Math.max(...sportCounts.map((s) => s.count), 1));
</script>

{#if sportCounts.length === 0}
	<div class="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">
		No sporting entries yet
	</div>
{:else}
	<div class="space-y-4">
		<div class="text-sm text-gray-500 dark:text-gray-400">
			{total} total sporting {total === 1 ? 'entry' : 'entries'}
		</div>

		{#each grouped as group}
			<div>
				<div
					class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2"
				>
					{group.group}
				</div>
				<div class="space-y-1.5">
					{#each group.items as item}
						{@const pct = (item.count / maxCount) * 100}
						<div class="flex items-center gap-2">
							<div class="w-28 flex items-center gap-1 shrink-0">
								<span class="text-sm">{item.emoji}</span>
								<span class="text-sm text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
							</div>
							<div class="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
								<div
									class="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 transition-all duration-500"
									style="width: {pct}%"
								></div>
							</div>
							<div class="w-8 text-right text-xs text-gray-500 dark:text-gray-400 shrink-0">
								{item.count}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}
