<script lang="ts">
	import { celebrations, type CelebrationToast } from '$lib/stores/celebrations';

	let queue = $state<CelebrationToast[]>([]);

	$effect(() => {
		const unsubscribe = celebrations.subscribe((value) => {
			queue = value;
		});
		return unsubscribe;
	});
</script>

{#if queue.length > 0}
	<div class="fixed top-4 right-4 z-[100] w-[calc(100%-2rem)] max-w-sm space-y-2 pointer-events-none">
		{#each queue as toast (toast.id)}
			<div
				class="rounded-xl border p-3 shadow-xl pointer-events-auto transition-all duration-300 {toast.type === 'achievement' ? 'bg-gradient-to-r from-yellow-500 to-orange-500 border-yellow-400 text-white' : 'bg-indigo-600 border-indigo-500 text-white'}"
				role="status"
				aria-live="polite"
			>
				<div class="flex items-start gap-2">
					<div class="text-2xl leading-none">{toast.emoji}</div>
					<div class="flex-1 min-w-0">
						<div class="text-xs uppercase tracking-wide opacity-90">{toast.title}</div>
						<div class="text-sm font-semibold break-words">{toast.message}</div>
					</div>
					<button
						onclick={() => celebrations.remove(toast.id)}
						class="text-white/80 hover:text-white text-xs px-1"
						aria-label="Dismiss celebration"
					>
						✕
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}
