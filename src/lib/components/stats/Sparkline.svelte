<script lang="ts">
	const WIDTH = 60;
	const HEIGHT = 20;

	const gradientId = `sg-${Math.random().toString(36).slice(2, 8)}`;

	let { values, class: className = '' }: { values: number[]; class?: string } = $props();

	let hoveredDay = $state<number | null>(null);

	const hasData = $derived(values.some(v => v > 0));
	const n = $derived(values.length);
	const max = $derived(Math.max(...values, 1));

	// Compute SVG points with small top/bottom padding so strokes aren't clipped
	const pts = $derived(values.map((v, i) => ({
		x: n > 1 ? (i / (n - 1)) * WIDTH : WIDTH / 2,
		y: HEIGHT * 0.9 - (v / max) * HEIGHT * 0.8
	})));

	const strokePath = $derived(
		`M${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`
	);

	const areaPath = $derived(
		`${strokePath} L${pts[pts.length - 1].x.toFixed(1)},${HEIGHT} L${pts[0].x.toFixed(1)},${HEIGHT} Z`
	);

	const endPt = $derived(pts[pts.length - 1]);

	const trend = $derived.by(() => {
		const mid = Math.floor(n / 2);
		const first = values.slice(0, mid).reduce((a, b) => a + b, 0);
		const last = values.slice(mid).reduce((a, b) => a + b, 0);
		if (first === 0 && last === 0) return 'flat' as const;
		if (last > first * 1.05) return 'rising' as const;
		if (last < first * 0.95) return 'falling' as const;
		return 'flat' as const;
	});

	const color = $derived(
		trend === 'rising' ? '#10b981' :
		trend === 'falling' ? '#f43f5e' :
		'#9ca3af'
	);

	const dayLabels = $derived(Array.from({ length: n }, (_, i) => {
		const d = new Date();
		d.setDate(d.getDate() - (n - 1 - i));
		return d.toLocaleDateString('en-GB', { weekday: 'short' });
	}));

</script>

{#if hasData}
	<div class="relative {className}" style="overflow: visible">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<svg
			viewBox="0 0 {WIDTH} {HEIGHT}"
			preserveAspectRatio="none"
			class="w-full h-full overflow-visible"
			role="img"
			aria-label="7-day activity sparkline"
			onmousemove={(e) => {
				const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
				hoveredDay = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)));
			}}
			onmouseleave={() => hoveredDay = null}
		>
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color={color} stop-opacity="0.3" />
					<stop offset="100%" stop-color={color} stop-opacity="0" />
				</linearGradient>
			</defs>

			<!-- Area fill -->
			<path d={areaPath} fill="url(#{gradientId})" />

			<!-- Stroke line -->
			<path
				d={strokePath}
				fill="none"
				stroke={color}
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>

			<!-- End-point dot -->
			<circle cx={endPt.x} cy={endPt.y} r="1.8" fill={color} />
		</svg>

		<!-- Custom tooltip rendered above the sparkline -->
		{#if hoveredDay !== null}
			<div
				class="absolute bottom-full mb-1 pointer-events-none z-20 bg-gray-800 text-white text-[9px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg"
				style="left: {((hoveredDay + 0.5) / n * 100).toFixed(1)}%; transform: translateX(-50%)"
			>
				{dayLabels[hoveredDay]}: {values[hoveredDay]}
			</div>
		{/if}
	</div>
{/if}
