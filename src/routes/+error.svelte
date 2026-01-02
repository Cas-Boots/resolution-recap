<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>{$page.status} | Resolution Recap</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-4">
	<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 md:p-12 max-w-md w-full text-center">
		<!-- Error illustration -->
		<div class="mb-6">
			{#if $page.status === 401}
				<div class="text-8xl mb-4">🔑</div>
				<div class="text-6xl font-bold text-blue-500 dark:text-blue-400">401</div>
			{:else if $page.status === 402}
				<div class="text-8xl mb-4">💳</div>
				<div class="text-6xl font-bold text-emerald-500 dark:text-emerald-400">402</div>
			{:else if $page.status === 403}
				<div class="text-8xl mb-4">🚫</div>
				<div class="text-6xl font-bold text-amber-500 dark:text-amber-400">403</div>
			{:else if $page.status === 404}
				<div class="text-8xl mb-4">🔍</div>
				<div class="text-6xl font-bold text-indigo-500 dark:text-indigo-400">404</div>
			{:else if $page.status >= 500}
				<div class="text-8xl mb-4">💥</div>
				<div class="text-6xl font-bold text-red-500 dark:text-red-400">{$page.status}</div>
			{:else}
				<div class="text-8xl mb-4">😕</div>
				<div class="text-6xl font-bold text-gray-500 dark:text-gray-400">{$page.status}</div>
			{/if}
		</div>

		<!-- Error message -->
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
			{#if $page.status === 401}
				Authentication Required
			{:else if $page.status === 402}
				Payment Required
			{:else if $page.status === 403}
				Access Forbidden
			{:else if $page.status === 404}
				Page Not Found
			{:else if $page.status >= 500}
				Server Error
			{:else}
				Something Went Wrong
			{/if}
		</h1>

		<p class="text-gray-600 dark:text-gray-300 mb-8">
			{#if $page.status === 401}
				Please log in or enter your PIN to access this page.
			{:else if $page.status === 402}
				This feature requires a subscription or payment.
			{:else if $page.status === 403}
				You don't have permission to access this page.
			{:else if $page.status === 404}
				The page you're looking for doesn't exist or has been moved.
			{:else if $page.error?.message}
				{$page.error.message}
			{:else}
				An unexpected error occurred. Please try again later.
			{/if}
		</p>

		<!-- Action buttons -->
		<div class="flex flex-col sm:flex-row gap-3 justify-center">
			<a
				href="{base}/"
				class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors"
			>
				<span>🏠</span>
				<span>Go Home</span>
			</a>
			<button
				onclick={() => history.back()}
				class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
			>
				<span>←</span>
				<span>Go Back</span>
			</button>
		</div>

		<!-- Fun resolution message -->
		{#if $page.status === 401}
			<div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
				<p class="text-sm text-gray-500 dark:text-gray-400 italic">
					"Your resolution to stay secure is working! Now just enter that PIN. 🔐"
				</p>
			</div>
		{:else if $page.status === 402}
			<div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
				<p class="text-sm text-gray-500 dark:text-gray-400 italic">
					"Investing in yourself is always a good resolution! 💰"
				</p>
			</div>
		{:else if $page.status === 403}
			<div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
				<p class="text-sm text-gray-500 dark:text-gray-400 italic">
					"Some doors are meant to stay closed... but there's plenty more to explore! 🚪"
				</p>
			</div>
		{:else if $page.status === 404}
			<div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
				<p class="text-sm text-gray-500 dark:text-gray-400 italic">
					"Finding lost pages wasn't one of your resolutions... but tracking progress is! 🎯"
				</p>
			</div>
		{/if}
	</div>
</div>
