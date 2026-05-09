<script lang="ts">
	import type { AchievementDef } from '$lib/server/db';

	interface UnlockedAchievement {
		key: string;
		unlocked_at: string;
	}

	interface Props {
		achievements: UnlockedAchievement[];
		allAchievements: AchievementDef[];
	}

	let { achievements, allAchievements }: Props = $props();

	const unlockedKeys = $derived(new Set(achievements.map(a => a.key)));
</script>

<!-- Achievements/Badges -->
<div class="bg-white rounded-xl shadow-lg p-4">
	<div class="flex items-center justify-between mb-4">
		<h2 class="font-semibold text-gray-800">🏅 Achievements</h2>
		<span class="text-sm text-gray-500">{unlockedKeys.size} / {allAchievements.length} unlocked</span>
	</div>

	<!-- Progress bar -->
	<div class="h-3 bg-gray-200 rounded-full overflow-hidden mb-6">
		<div
			class="h-full bg-gradient-to-r from-yellow-400 to-yellow-600"
			style="width: {((unlockedKeys.size / (allAchievements.length || 1)) * 100)}%"
		></div>
	</div>

	<!-- Achievement grid -->
	<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
		{#each allAchievements as achievement}
			{@const isUnlocked = unlockedKeys.has(achievement.key)}
			{@const unlockData = achievements.find(a => a.key === achievement.key)}
			<div
				class="p-3 rounded-xl border-2 transition-all {isUnlocked
					? achievement.rarity === 'legendary' ? 'bg-gradient-to-br from-yellow-50 to-amber-100 border-yellow-400'
					: achievement.rarity === 'epic' ? 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-400'
					: achievement.rarity === 'rare' ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-400'
					: 'bg-gradient-to-br from-green-50 to-green-100 border-green-400'
					: 'bg-gray-50 border-gray-200 opacity-50'}"
			>
				<div class="text-3xl text-center mb-2 {isUnlocked ? '' : 'grayscale'}">
					{achievement.emoji}
				</div>
				<div class="text-center">
					<div class="font-medium text-sm {isUnlocked ? 'text-gray-800' : 'text-gray-400'}">
						{achievement.name}
					</div>
					<div class="text-xs {isUnlocked ? 'text-gray-600' : 'text-gray-400'} mt-1">
						{achievement.description}
					</div>
					{#if isUnlocked && unlockData}
						<div class="text-xs text-green-600 mt-2">
							✓ {unlockData.unlocked_at.split('T')[0]}
						</div>
					{/if}
					<div class="mt-2">
						<span class="text-xs px-2 py-0.5 rounded-full {
							achievement.rarity === 'legendary' ? 'bg-yellow-200 text-yellow-800' :
							achievement.rarity === 'epic' ? 'bg-purple-200 text-purple-800' :
							achievement.rarity === 'rare' ? 'bg-blue-200 text-blue-800' :
							'bg-gray-200 text-gray-600'
						}">
							{achievement.rarity}
						</span>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
