<script lang="ts">
	import '../app.css';
	import PinOverlay from '$lib/components/PinOverlay.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';

	interface Props {
		data: { role?: 'tracker' | 'admin' };
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	let role = $state<'tracker' | 'admin' | undefined>(data.role);

	function handleAuthSuccess(newRole: 'tracker' | 'admin') {
		role = newRole;
		// Redirect based on role
		if (newRole === 'admin') {
			goto(`${base}/admin`);
		} else {
			goto(`${base}/`);
		}
	}

	function handleLogout() {
		role = undefined;
	}

	// Check if current path is allowed for role
	$effect(() => {
		if (role) {
			const path = page.url.pathname;
			const isAdminPath = path.includes('/admin');
			
			if (role === 'admin' && !isAdminPath) {
				goto(`${base}/admin`);
			} else if (role === 'tracker' && isAdminPath) {
				goto(`${base}/`);
			}
		}
	});
</script>

<svelte:head>
	<meta name="theme-color" content="#6366f1" />
</svelte:head>

{#if !role}
	<PinOverlay onSuccess={handleAuthSuccess} />
{:else}
	<div class="min-h-screen flex flex-col">
		<Navigation {role} onLogout={handleLogout} />
		<main class="flex-1 p-4 max-w-4xl mx-auto w-full">
			{@render children()}
		</main>
	</div>
{/if}
