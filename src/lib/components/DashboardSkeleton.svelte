<script lang="ts">
	import Skeleton from './Skeleton.svelte';
</script>

<!-- Dashboard Header Skeleton -->
<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<Skeleton width="180px" height="2rem" rounded="lg" class="mb-2" />
			<Skeleton width="120px" height="1rem" />
		</div>
		<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
			<Skeleton width="200px" height="2.5rem" rounded="2xl" />
			<Skeleton width="140px" height="2.5rem" rounded="xl" />
		</div>
	</div>
</div>

<!-- Today's Activity Skeleton -->
<div class="bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-800 rounded-2xl shadow-lg p-4 sm:p-5">
	<div class="flex items-center justify-between mb-3 gap-2">
		<Skeleton width="160px" height="1.5rem" rounded="lg" class="bg-white/20" />
		<Skeleton width="80px" height="1.5rem" rounded="full" class="bg-white/20" />
	</div>
	<div class="flex flex-wrap gap-2 sm:gap-3">
		{#each Array(3) as _}
			<div class="bg-white/15 backdrop-blur rounded-xl px-3 sm:px-4 py-2 flex items-center gap-2">
				<Skeleton width="2rem" height="2rem" rounded="full" class="bg-white/20" />
				<div>
					<Skeleton width="60px" height="0.875rem" class="mb-1 bg-white/20" />
					<Skeleton width="40px" height="0.75rem" class="bg-white/20" />
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- Quick Add Section Skeleton -->
<div class="bg-gradient-to-br from-gray-400 to-gray-500 dark:from-gray-700 dark:to-gray-800 rounded-2xl shadow-lg p-4 sm:p-6">
	<Skeleton width="140px" height="1.5rem" rounded="lg" class="mb-4 bg-white/20" />
	<div class="space-y-3 sm:space-y-4">
		{#each Array(2) as _}
			<div>
				<Skeleton width="80px" height="1rem" class="mb-2 bg-white/20" />
				<div class="flex flex-wrap gap-2">
					{#each Array(4) as _}
						<Skeleton width="100px" height="2.5rem" rounded="xl" class="bg-white/20" />
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- Stats Cards Skeleton (Mobile) -->
<div class="md:hidden space-y-3">
	{#each Array(3) as _}
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-3 sm:p-4">
			<div class="flex items-center gap-2 mb-3">
				<Skeleton width="2rem" height="2rem" rounded="full" />
				<Skeleton width="100px" height="1.25rem" />
			</div>
			<div class="grid grid-cols-2 gap-2 sm:gap-3">
				{#each Array(2) as _}
					<div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 sm:p-3 text-center">
						<Skeleton width="3rem" height="1.75rem" rounded="lg" class="mx-auto mb-1" />
						<Skeleton width="4rem" height="0.75rem" class="mx-auto" />
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>

<!-- Stats Table Skeleton (Desktop) -->
<div class="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
	<div class="bg-gray-50 dark:bg-gray-700 px-6 py-3 flex gap-6">
		<Skeleton width="100px" height="1rem" />
		<Skeleton width="80px" height="1rem" />
		<Skeleton width="80px" height="1rem" />
	</div>
	{#each Array(4) as _}
		<div class="px-6 py-4 flex items-center gap-6 border-t dark:border-gray-700">
			<div class="flex items-center gap-2 w-32">
				<Skeleton width="1.5rem" height="1.5rem" rounded="full" />
				<Skeleton width="80px" height="1rem" />
			</div>
			{#each Array(2) as _}
				<div class="flex flex-col items-center gap-1">
					<Skeleton width="3rem" height="3rem" rounded="full" />
					<Skeleton width="4rem" height="0.5rem" />
				</div>
			{/each}
		</div>
	{/each}
</div>

<!-- Recent Entries Skeleton -->
<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
	<div class="bg-gray-50 dark:bg-gray-700 px-3 sm:px-4 py-2 sm:py-3 border-b dark:border-gray-600">
		<Skeleton width="140px" height="1.25rem" />
	</div>
	{#each Array(4) as _}
		<div class="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 border-b dark:border-gray-700 last:border-0">
			<Skeleton width="1.5rem" height="1.5rem" rounded="full" />
			<div class="flex-1">
				<Skeleton width="70%" height="1rem" class="mb-1" />
				<Skeleton width="40%" height="0.75rem" />
			</div>
			<Skeleton width="50px" height="0.75rem" />
		</div>
	{/each}
</div>
