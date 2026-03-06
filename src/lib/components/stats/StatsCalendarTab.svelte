<script lang="ts">
	interface CalendarDay {
		date: string;
		count: number;
	}

	interface CalendarData {
		days: { date: string; count: number }[];
		maxCount: number;
		weeks: (CalendarDay | null)[][];
	}

	interface MonthLabel {
		month: string;
		weekIndex: number;
	}

	interface PersonOption {
		id: number;
		name: string;
		emoji?: string | null;
	}

	interface MetricOption {
		id: number;
		name: string;
		emoji?: string | null;
	}

	interface Props {
		calendarData: CalendarData;
		monthLabels: MonthLabel[];
		people: PersonOption[];
		metrics: MetricOption[];
		selectedCalendarPerson?: number | null;
		selectedCalendarMetric?: number | null;
		getHeatmapColor: (count: number, maxCount: number, isOddMonth: boolean) => string;
		formatDateForTooltip: (dateStr: string) => string;
		getTranslatedMetricName: (metric: MetricOption) => string;
	}

	let {
		calendarData,
		monthLabels,
		people,
		metrics,
		selectedCalendarPerson = $bindable<number | null>(null),
		selectedCalendarMetric = $bindable<number | null>(null),
		getHeatmapColor,
		formatDateForTooltip,
		getTranslatedMetricName
	}: Props = $props();
</script>

<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-lg font-bold text-gray-800 dark:text-white">📆 Activity Calendar</h2>
		<div class="flex items-center gap-2">
			<select
				bind:value={selectedCalendarPerson}
				class="px-3 py-2 border dark:border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white dark:bg-gray-700 dark:text-white"
			>
				<option value={null}>All People</option>
				{#each people || [] as person}
					<option value={person.id}>{person.emoji || '👤'} {person.name}</option>
				{/each}
			</select>
			<select
				bind:value={selectedCalendarMetric}
				class="px-3 py-2 border dark:border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white dark:bg-gray-700 dark:text-white"
			>
				<option value={null}>All Metrics</option>
				{#each metrics || [] as metric}
					<option value={metric.id}>{metric.emoji || '📊'} {getTranslatedMetricName(metric)}</option>
				{/each}
			</select>
		</div>
	</div>

	<div class="overflow-x-auto pb-1">
		<div class="min-w-[680px]">
			<div class="mb-1 ml-6 sm:ml-10">
				<div class="flex text-[8px] sm:text-xs text-gray-500 dark:text-gray-400 relative" style="min-width: fit-content;">
					{#each monthLabels as label}
						<div
							class="absolute"
							style="left: calc({label.weekIndex} * (100% / {calendarData.weeks.length}))"
						>
							{label.month}
						</div>
					{/each}
					<div class="w-full h-4"></div>
				</div>
			</div>

			<div class="flex gap-[2px]">
				<div class="flex flex-col gap-[1px] sm:gap-[2px] text-[8px] sm:text-[10px] text-gray-500 dark:text-gray-400 pr-1 flex-shrink-0">
					<div class="h-[8px] sm:h-[10px] flex items-center">M</div>
					<div class="h-[8px] sm:h-[10px] flex items-center">T</div>
					<div class="h-[8px] sm:h-[10px] flex items-center">W</div>
					<div class="h-[8px] sm:h-[10px] flex items-center">T</div>
					<div class="h-[8px] sm:h-[10px] flex items-center">F</div>
					<div class="h-[8px] sm:h-[10px] flex items-center">S</div>
					<div class="h-[8px] sm:h-[10px] flex items-center">S</div>
				</div>

				<div class="flex gap-[1px] sm:gap-[2px]">
					{#each calendarData.weeks as week}
						<div class="flex flex-col gap-[1px] sm:gap-[2px]">
							{#each week as day}
								{#if day}
									{@const month = parseInt(day.date.split('-')[1])}
									{@const isOddMonth = month % 2 === 1}
									<div
										class="w-[8px] h-[8px] sm:w-[12px] sm:h-[12px] rounded-[2px] {getHeatmapColor(day.count, calendarData.maxCount, isOddMonth)} cursor-pointer hover:ring-1 hover:ring-indigo-400"
										title="{formatDateForTooltip(day.date)}: {day.count} {day.count === 1 ? 'entry' : 'entries'}"
									></div>
								{:else}
									<div class="w-[8px] h-[8px] sm:w-[12px] sm:h-[12px]"></div>
								{/if}
							{/each}
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<div class="flex items-center justify-end gap-1 sm:gap-2 mt-4 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
		<span>Less</span>
		<div class="w-[8px] h-[8px] sm:w-[12px] sm:h-[12px] rounded-[2px] bg-gray-200 dark:bg-gray-600"></div>
		<div class="w-[8px] h-[8px] sm:w-[12px] sm:h-[12px] rounded-[2px] bg-green-200 dark:bg-green-900"></div>
		<div class="w-[8px] h-[8px] sm:w-[12px] sm:h-[12px] rounded-[2px] bg-green-400 dark:bg-green-700"></div>
		<div class="w-[8px] h-[8px] sm:w-[12px] sm:h-[12px] rounded-[2px] bg-green-500 dark:bg-green-500"></div>
		<div class="w-[8px] h-[8px] sm:w-[12px] sm:h-[12px] rounded-[2px] bg-green-600 dark:bg-green-400"></div>
		<span>More</span>
	</div>

	<div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-center">
		<div>
			<div class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">{calendarData.days.filter((d) => d.count > 0).length}</div>
			<div class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Active Days</div>
		</div>
		<div>
			<div class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">{calendarData.days.reduce((sum, d) => sum + d.count, 0)}</div>
			<div class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Total Entries</div>
		</div>
		<div>
			<div class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">{calendarData.maxCount}</div>
			<div class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Best Day</div>
		</div>
	</div>
</div>
