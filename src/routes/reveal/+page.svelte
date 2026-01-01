<script lang="ts">
	import type { PageData } from './$types';
	import { base } from '$app/paths';
	import { getRank, getRankDisplay } from '$lib/ranking';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let currentSlide = $state(0);
	let revealedItems = $state<Set<number>>(new Set());
	let mode = $state<'awards' | 'trivia' | 'leaderboard'>('awards');
	let triviaRevealed = $state<Set<string>>(new Set());
	let isFullscreen = $state(false);

	const allAwards = $derived(data.awards || []);
	const allTrivia = $derived(data.trivia || []);

	// Group stats by person for leaderboard
	const leaderboard = $derived.by(() => {
		if (!data.stats) return [];
		const grouped = new Map<string, { name: string; emoji: string; total: number; metrics: Record<string, number> }>();
		
		for (const stat of data.stats) {
			if (!grouped.has(stat.person_name)) {
				grouped.set(stat.person_name, { name: stat.person_name, emoji: stat.person_emoji, total: 0, metrics: {} });
			}
			const person = grouped.get(stat.person_name)!;
			person.total += stat.count;
			person.metrics[stat.metric_name] = stat.count;
		}
		
		return [...grouped.values()].sort((a, b) => b.total - a.total);
	});

	function nextSlide() {
		if (mode === 'awards') {
			if (currentSlide < allAwards.length - 1) {
				currentSlide++;
			}
		} else if (mode === 'leaderboard') {
			// Reveal one position at a time from bottom
			const nextReveal = leaderboard.length - 1 - revealedItems.size;
			if (nextReveal >= 0) {
				revealedItems = new Set([...revealedItems, nextReveal]);
			}
		}
	}

	function prevSlide() {
		if (mode === 'awards' && currentSlide > 0) {
			currentSlide--;
		}
	}

	function revealTrivia(id: string) {
		triviaRevealed = new Set([...triviaRevealed, id]);
	}

	function resetReveal() {
		currentSlide = 0;
		revealedItems = new Set();
		triviaRevealed = new Set();
	}

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen();
			isFullscreen = true;
		} else {
			document.exitFullscreen();
			isFullscreen = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight' || event.key === ' ') {
			nextSlide();
		} else if (event.key === 'ArrowLeft') {
			prevSlide();
		} else if (event.key === 'f') {
			toggleFullscreen();
		} else if (event.key === 'Escape' && isFullscreen) {
			document.exitFullscreen();
			isFullscreen = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
	<!-- Header -->
	<div class="p-4 flex items-center justify-between bg-black/20">
		<a href="{base}/stats" class="text-white/70 hover:text-white flex items-center gap-2">
			← Back to Stats
		</a>
		<h1 class="text-xl font-bold">🎉 Year-End Reveal</h1>
		<div class="flex gap-2">
			<button
				onclick={toggleFullscreen}
				class="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm"
			>
				{isFullscreen ? '⛶ Exit' : '⛶ Fullscreen'}
			</button>
			<button
				onclick={resetReveal}
				class="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm"
			>
				🔄 Reset
			</button>
		</div>
	</div>

	{#if !data.season}
		<div class="flex items-center justify-center h-[80vh]">
			<div class="text-center text-white/70">
				<div class="text-6xl mb-4">📭</div>
				<p>No active season found</p>
			</div>
		</div>
	{:else}
		<!-- Mode tabs -->
		<div class="flex justify-center gap-2 py-4">
			<button
				onclick={() => { mode = 'awards'; resetReveal(); }}
				class="px-6 py-2 rounded-full font-medium transition-all {mode === 'awards' ? 'bg-yellow-500 text-yellow-900' : 'bg-white/20 hover:bg-white/30'}"
			>
				🏆 Awards
			</button>
			<button
				onclick={() => { mode = 'trivia'; resetReveal(); }}
				class="px-6 py-2 rounded-full font-medium transition-all {mode === 'trivia' ? 'bg-green-500 text-green-900' : 'bg-white/20 hover:bg-white/30'}"
			>
				❓ Trivia
			</button>
			<button
				onclick={() => { mode = 'leaderboard'; resetReveal(); }}
				class="px-6 py-2 rounded-full font-medium transition-all {mode === 'leaderboard' ? 'bg-blue-500 text-blue-900' : 'bg-white/20 hover:bg-white/30'}"
			>
				📊 Leaderboard
			</button>
		</div>

		{#if mode === 'awards'}
			<!-- Awards reveal -->
			<div class="flex flex-col items-center justify-center min-h-[60vh] px-4">
				{#if allAwards.length === 0}
					<div class="text-center text-white/70">
						<div class="text-6xl mb-4">🏆</div>
						<p>No awards yet - need more data!</p>
					</div>
				{:else}
					{@const award = allAwards[currentSlide]}
					<div class="text-center animate-fade-in" style="animation: fadeIn 0.5s ease-out">
						<div class="text-8xl mb-6 animate-bounce">{award.emoji}</div>
						<h2 class="text-4xl font-bold mb-4">{award.title}</h2>
						<div class="flex items-center justify-center gap-4 mb-6">
							<span class="text-6xl">{award.personEmoji}</span>
							<span class="text-5xl font-bold text-yellow-300">{award.personName}</span>
						</div>
						<p class="text-xl text-white/80 mb-2">{award.description}</p>
						{#if award.value}
							<p class="text-2xl font-semibold text-yellow-400">{award.value}</p>
						{/if}
					</div>

					<!-- Navigation -->
					<div class="flex items-center gap-6 mt-12">
						<button
							onclick={prevSlide}
							disabled={currentSlide === 0}
							class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center disabled:opacity-30 hover:bg-white/30"
						>
							←
						</button>
						<span class="text-white/60">{currentSlide + 1} / {allAwards.length}</span>
						<button
							onclick={nextSlide}
							disabled={currentSlide === allAwards.length - 1}
							class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center disabled:opacity-30 hover:bg-white/30"
						>
							→
						</button>
					</div>
				{/if}
			</div>

		{:else if mode === 'trivia'}
			<!-- Trivia mode -->
			<div class="max-w-2xl mx-auto px-4 py-8 space-y-4">
				{#if allTrivia.length === 0}
					<div class="text-center text-white/70 py-20">
						<div class="text-6xl mb-4">❓</div>
						<p>No trivia available yet - need more data!</p>
					</div>
				{:else}
					{#each allTrivia as question}
						<div 
							class="bg-white/10 backdrop-blur rounded-xl p-6 cursor-pointer hover:bg-white/20 transition-all"
							onclick={() => revealTrivia(question.id)}
						>
							<div class="flex items-start gap-4">
								<span class="text-2xl">
									{#if question.category === 'person'}👤
									{:else if question.category === 'metric'}📊
									{:else if question.category === 'streak'}🔥
									{:else}🎯{/if}
								</span>
								<div class="flex-1">
									<p class="text-lg font-medium mb-2">{question.question}</p>
									{#if triviaRevealed.has(question.id)}
										<div class="mt-3 p-3 bg-green-500/30 rounded-lg animate-fade-in">
											<span class="text-xl font-bold text-green-300">{question.answer}</span>
										</div>
									{:else}
										<div class="flex items-center gap-2 text-white/50">
											<span>Tap to reveal</span>
											{#if question.hint}
												<span class="text-sm">• Hint: {question.hint}</span>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>

		{:else if mode === 'leaderboard'}
			<!-- Leaderboard reveal -->
			<div class="max-w-md mx-auto px-4 py-8">
				<div class="text-center mb-8">
					<h2 class="text-3xl font-bold">Final Standings</h2>
					<p class="text-white/60 mt-2">Tap or press → to reveal each position</p>
				</div>

				{#if leaderboard.length === 0}
					<div class="text-center text-white/70 py-20">
						<div class="text-6xl mb-4">📊</div>
						<p>No entries yet!</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each leaderboard as person, i}
							{@const isRevealed = revealedItems.has(i)}
							{@const rank = getRank(i, leaderboard, p => p.total)}
							<div 
								class="p-4 rounded-xl transition-all duration-500 {isRevealed ? 'bg-white/20' : 'bg-white/5'}"
								style="transform: {isRevealed ? 'scale(1)' : 'scale(0.95)'}; opacity: {isRevealed ? '1' : '0.3'}"
							>
								<div class="flex items-center gap-4">
									<div class="text-3xl font-bold w-12 text-center">
										{#if isRevealed}
											{getRankDisplay(rank)}
										{:else}
											?
										{/if}
									</div>
									<div class="text-3xl">
										{#if isRevealed}{person.emoji}{:else}❓{/if}
									</div>
									<div class="flex-1">
										<div class="text-xl font-bold">
											{#if isRevealed}{person.name}{:else}???{/if}
										</div>
										{#if isRevealed}
											<div class="text-sm text-white/60">
												{#each Object.entries(person.metrics) as [metric, count]}
													<span class="mr-3">{metric}: {count}</span>
												{/each}
											</div>
										{/if}
									</div>
									<div class="text-2xl font-bold {rank === 1 && isRevealed ? 'text-yellow-400' : ''}">
										{#if isRevealed}{person.total}{:else}?{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>

					<div class="text-center mt-8">
						<button
							onclick={nextSlide}
							disabled={revealedItems.size >= leaderboard.length}
							class="px-8 py-3 bg-white/20 rounded-full font-medium hover:bg-white/30 disabled:opacity-30"
						>
							{revealedItems.size === 0 ? 'Start Reveal' : revealedItems.size >= leaderboard.length ? 'All Revealed!' : 'Reveal Next'}
						</button>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.animate-fade-in {
		animation: fadeIn 0.5s ease-out;
	}
</style>
