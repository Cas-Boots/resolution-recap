<script lang="ts">
	import '../app.css';
	import PinOverlay from '$lib/components/PinOverlay.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { navigating } from '$app/stores';

	interface Props {
		data: { role?: 'tracker' | 'admin' };
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	// We intentionally capture initial role and update it locally on auth changes
	const initialRole = data.role;
	let role = $state<'tracker' | 'admin' | undefined>(initialRole);
	let isNavigating = $state(false);

	// Subscribe to navigating store
	$effect(() => {
		const unsubscribe = navigating.subscribe(nav => {
			isNavigating = nav !== null;
		});
		return unsubscribe;
	});

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
		<!-- Navigation loading bar -->
		{#if isNavigating}
			<div class="fixed top-0 left-0 right-0 z-50 h-1 bg-indigo-100 dark:bg-indigo-900 overflow-hidden">
				<div class="h-full bg-indigo-500 animate-loading-bar"></div>
			</div>
		{/if}
		
		<Navigation {role} onLogout={handleLogout} />
		<main class="flex-1 p-4 max-w-4xl mx-auto w-full">
			{@render children()}
		</main>
	</div>
{/if}

<style>
	@keyframes loading-bar {
		0% {
			width: 0%;
			margin-left: 0%;
		}
		50% {
			width: 60%;
			margin-left: 20%;
		}
		100% {
			width: 0%;
			margin-left: 100%;
		}
	}
	
	.animate-loading-bar {
		animation: loading-bar 1.5s ease-in-out infinite;
	}
</style>
