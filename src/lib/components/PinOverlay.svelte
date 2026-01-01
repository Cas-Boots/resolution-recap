<script lang="ts">
	import { base } from '$app/paths';

	interface Props {
		onSuccess: (role: 'tracker' | 'admin') => void;
	}

	let { onSuccess }: Props = $props();

	let pin = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!pin.trim()) return;

		loading = true;
		error = '';

		try {
			const res = await fetch(`${base}/api/auth`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pin })
			});

			if (res.ok) {
				const data = await res.json();
				onSuccess(data.role);
			} else {
				error = 'Invalid PIN';
				pin = '';
			}
		} catch {
			error = 'Connection error';
		} finally {
			loading = false;
		}
	}
</script>

<div class="fixed inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-4 z-50">
	<div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
		<div class="text-center mb-6">
			<h1 class="text-2xl font-bold text-gray-800">🎯 Resolution Recap</h1>
			<p class="text-gray-500 mt-2">Enter PIN to continue</p>
		</div>

		<form onsubmit={handleSubmit} class="space-y-4">
			<input
				type="password"
				bind:value={pin}
				placeholder="Enter PIN"
				class="w-full px-4 py-3 text-center text-2xl tracking-widest border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
				disabled={loading}
				autocomplete="off"
			/>

			{#if error}
				<p class="text-red-500 text-center text-sm">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading || !pin.trim()}
				class="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{loading ? 'Checking...' : 'Enter'}
			</button>
		</form>
	</div>
</div>
