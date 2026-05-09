<script lang="ts">
	interface CumulativeStat {
		date: string;
		cumulative: number;
		expected: number;
	}

	interface Props {
		cumulativeStats: CumulativeStat[];
		seasonYear: number;
		personName: string;
		personEmoji: string;
	}

	let { cumulativeStats, seasonYear, personName, personEmoji }: Props = $props();

	// Chart layout constants
	const LEFT = 50;
	const RIGHT = 780;
	const TOP = 10;
	const BOTTOM = 190;
	const WIDTH = RIGHT - LEFT;   // 730
	const HEIGHT = BOTTOM - TOP;  // 180

	// Sort by date ascending
	const sorted = $derived([...cumulativeStats].sort((a, b) => a.date.localeCompare(b.date)));

	const maxValue = $derived.by(() => {
		if (sorted.length === 0) return 100;
		const maxCumulative = Math.max(...sorted.map((d) => d.cumulative));
		const maxExpected = Math.max(...sorted.map((d) => d.expected));
		return Math.max(maxCumulative, maxExpected, 1);
	});

	// Map a date string to an X coordinate using the season year (Jan 1 – Dec 31)
	function dateToX(dateStr: string): number {
		const seasonStart = new Date(seasonYear, 0, 1).getTime();
		const seasonEnd = new Date(seasonYear, 11, 31).getTime();
		const t = new Date(dateStr).getTime();
		const ratio = Math.max(0, Math.min(1, (t - seasonStart) / (seasonEnd - seasonStart)));
		return LEFT + ratio * WIDTH;
	}

	function valueToY(v: number): number {
		return BOTTOM - (v / maxValue) * HEIGHT;
	}

	const actualPoints = $derived(
		sorted.map((d) => `${dateToX(d.date).toFixed(1)},${valueToY(d.cumulative).toFixed(1)}`).join(' ')
	);

	const expectedPoints = $derived(
		sorted.map((d) => `${dateToX(d.date).toFixed(1)},${valueToY(d.expected).toFixed(1)}`).join(' ')
	);

	// Area fill polygon for actual line: close at the bottom
	const areaPoints = $derived.by(() => {
		if (sorted.length === 0) return '';
		const firstX = dateToX(sorted[0].date).toFixed(1);
		const lastX = dateToX(sorted[sorted.length - 1].date).toFixed(1);
		return `${firstX},${BOTTOM} ${actualPoints} ${lastX},${BOTTOM}`;
	});

	// End-point marker for actual line
	const lastPoint = $derived(sorted.length > 0 ? sorted[sorted.length - 1] : null);
	const lastX = $derived(lastPoint ? dateToX(lastPoint.date) : 0);
	const lastY = $derived(lastPoint ? valueToY(lastPoint.cumulative) : 0);

	// X-axis date labels
	const firstDate = $derived(sorted.length > 0 ? sorted[0].date : `${seasonYear}-01-01`);
	const lastDate = $derived(sorted.length > 0 ? sorted[sorted.length - 1].date : `${seasonYear}-12-31`);

	function formatShortDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Y-axis grid line values
	const gridRatios = [0, 0.25, 0.5, 0.75, 1];
</script>

<div
	class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 transition-colors duration-200"
>
	<div class="flex items-center justify-between mb-4">
		<h3 class="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
			<span>{personEmoji}</span>
			<span>{personName}</span>
			<span class="font-normal text-gray-500 dark:text-gray-400">— {seasonYear}</span>
		</h3>
		{#if sorted.length > 0}
			<div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
				<span class="flex items-center gap-1">
					<span class="inline-block w-5 border-t-2 border-indigo-500"></span>
					Actual
				</span>
				<span class="flex items-center gap-1">
					<span class="inline-block w-5 border-t-2 border-dashed border-gray-400"></span>
					Goal pace
				</span>
			</div>
		{/if}
	</div>

	{#if sorted.length === 0}
		<div
			class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm"
			style="height: 220px"
		>
			No entries yet this season
		</div>
	{:else}
		<div class="overflow-x-auto">
			<svg
				class="w-full min-w-[520px]"
				viewBox="0 0 800 220"
				preserveAspectRatio="none"
				role="img"
				aria-label="Cumulative progress chart for {personName}"
			>
				<defs>
					<linearGradient id="personActualGrad_{personName}" x1="0%" y1="0%" x2="0%" y2="100%">
						<stop offset="0%" stop-color="#6366f1" stop-opacity="0.35" />
						<stop offset="100%" stop-color="#6366f1" stop-opacity="0.04" />
					</linearGradient>
				</defs>

				<!-- Horizontal grid lines -->
				{#each gridRatios as ratio}
					{@const y = BOTTOM - ratio * HEIGHT}
					<line
						x1={LEFT}
						y1={y}
						x2={RIGHT}
						y2={y}
						stroke="currentColor"
						class="text-gray-100 dark:text-gray-700"
						stroke-width="1"
						stroke-dasharray={ratio === 0 ? '0' : '4,4'}
					/>
					<text
						x={LEFT - 8}
						y={y + 4}
						class="text-[10px] fill-gray-400 dark:fill-gray-500"
						text-anchor="end"
					>
						{Math.round(maxValue * ratio)}
					</text>
				{/each}

				<!-- Area fill (actual) -->
				<polygon
					fill="url(#personActualGrad_{personName})"
					points={areaPoints}
					opacity="0.6"
				/>

				<!-- Dashed expected/goal-pace line -->
				<polyline
					fill="none"
					stroke="#9ca3af"
					stroke-width="2"
					stroke-dasharray="6,4"
					stroke-linecap="round"
					stroke-linejoin="round"
					points={expectedPoints}
				/>

				<!-- Solid actual line -->
				<polyline
					fill="none"
					stroke="#6366f1"
					stroke-width="3"
					stroke-linecap="round"
					stroke-linejoin="round"
					points={actualPoints}
					class="drop-shadow-sm"
				/>

				<!-- End-point circle marker -->
				{#if lastPoint}
					<circle
						cx={lastX}
						cy={lastY}
						r="6"
						fill="#6366f1"
						stroke="white"
						stroke-width="2"
						class="drop-shadow"
					/>
				{/if}

				<!-- X-axis date labels -->
				<text x={LEFT} y="210" class="text-[10px] fill-gray-400 dark:fill-gray-500">
					{formatShortDate(firstDate)}
				</text>
				<text
					x={RIGHT}
					y="210"
					class="text-[10px] fill-gray-400 dark:fill-gray-500"
					text-anchor="end"
				>
					{formatShortDate(lastDate)}
				</text>
			</svg>
		</div>
	{/if}
</div>
