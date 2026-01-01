<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';

	interface Props {
		role: 'tracker' | 'admin';
		onLogout: () => void;
	}

	let { role, onLogout }: Props = $props();

	let menuOpen = $state(false);
	let darkMode = $state(false);

	// Initialize dark mode from localStorage on mount
	$effect(() => {
		if (browser) {
			const stored = localStorage.getItem('darkMode');
			if (stored !== null) {
				darkMode = stored === 'true';
			} else {
				// Check system preference
				darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
			}
			applyDarkMode(darkMode);
		}
	});

	function toggleDarkMode() {
		darkMode = !darkMode;
		if (browser) {
			localStorage.setItem('darkMode', String(darkMode));
			applyDarkMode(darkMode);
		}
	}

	function applyDarkMode(isDark: boolean) {
		if (isDark) {
			document.documentElement.classList.add('dark');
			document.body.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
			document.body.classList.remove('dark');
		}
	}

	// Primary links shown in main nav
	const primaryLinks = [
		{ href: `${base}/`, label: 'Home', icon: '📊' },
		{ href: `${base}/add`, label: 'Add', icon: '➕' },
		{ href: `${base}/stats`, label: 'Stats', icon: '📈' }
	];

	// Secondary links in "More" menu
	const secondaryLinks = [
		{ href: `${base}/countries`, label: 'Countries', icon: '🌍' },
		{ href: `${base}/teasers`, label: 'Teasers', icon: '📱' },
		{ href: `${base}/reveal`, label: 'Reveal', icon: '🎬' },
		{ href: `${base}/export`, label: 'Export', icon: '📄' },
		{ href: `${base}/settings`, label: 'Settings', icon: '⚙️' }
	];

	const adminLinks = [
		{ href: `${base}/admin`, label: 'Seasons', icon: '📅' },
		{ href: `${base}/admin/entries`, label: 'Entries', icon: '📝' },
		{ href: `${base}/admin/export`, label: 'Export', icon: '💾' }
	];

	const allLinks = $derived(role === 'admin' ? adminLinks : [...primaryLinks, ...secondaryLinks]);
	const mainLinks = $derived(role === 'admin' ? adminLinks : primaryLinks);
	const moreLinks = $derived(role === 'admin' ? [] : secondaryLinks);

	let moreMenuOpen = $state(false);

	function isActive(href: string): boolean {
		return page.url.pathname === href || 
			(href !== `${base}/` && page.url.pathname.startsWith(href));
	}

	function isMoreActive(): boolean {
		return moreLinks.some(link => isActive(link.href));
	}

	async function handleLogout() {
		await fetch(`${base}/api/auth`, { method: 'DELETE' });
		onLogout();
	}
</script>

<nav class="bg-white dark:bg-gray-800 shadow-lg sticky top-0 z-40">
	<div class="max-w-4xl mx-auto px-4">
		<div class="flex justify-between items-center h-14">
			<a href={mainLinks[0].href} class="font-bold text-indigo-600 dark:text-indigo-400 text-lg">
				🎯 Recap
			</a>

			<!-- Desktop nav -->
			<div class="hidden md:flex items-center gap-1">
				{#each mainLinks as link}
					<a
						href={link.href}
						class="px-3 py-2 rounded-lg text-sm font-medium transition-colors {isActive(link.href)
							? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
							: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
					>
						{link.icon} {link.label}
					</a>
				{/each}
				
				<!-- More dropdown (tracker only) -->
				{#if moreLinks.length > 0}
					<div class="relative">
						<button
							onclick={() => moreMenuOpen = !moreMenuOpen}
							class="px-3 py-2 rounded-lg text-sm font-medium transition-colors {isMoreActive()
								? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
								: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
						>
							⋯ More
						</button>
						
						{#if moreMenuOpen}
							<!-- Backdrop -->
							<button 
								class="fixed inset-0 z-10" 
								onclick={() => moreMenuOpen = false}
								aria-label="Close menu"
							></button>
							
							<!-- Dropdown -->
							<div class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border dark:border-gray-700 py-2 z-20">
								{#each moreLinks as link}
									<a
										href={link.href}
										onclick={() => moreMenuOpen = false}
										class="block px-4 py-2 text-sm transition-colors {isActive(link.href)
											? 'bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
											: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
									>
										{link.icon} {link.label}
									</a>
								{/each}
								<hr class="my-2 border-gray-200 dark:border-gray-700" />
								<button
									onclick={() => { toggleDarkMode(); moreMenuOpen = false; }}
									class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
								>
									{darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
								</button>
								<button
									onclick={() => { handleLogout(); moreMenuOpen = false; }}
									class="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
								>
									🚪 Logout
								</button>
							</div>
						{/if}
					</div>
				{:else}
					<!-- Admin: simple logout -->
					<button
						onclick={handleLogout}
						class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
					>
						🚪
					</button>
				{/if}
			</div>

			<!-- Mobile menu button -->
			<button
				class="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
				onclick={() => (menuOpen = !menuOpen)}
			>
				<span class="text-xl">{menuOpen ? '✕' : '☰'}</span>
			</button>
		</div>
	</div>

	<!-- Mobile nav -->
	{#if menuOpen}
		<div class="md:hidden border-t dark:border-gray-700 bg-white dark:bg-gray-800 pb-3">
			{#each allLinks as link}
				<a
					href={link.href}
					onclick={() => (menuOpen = false)}
					class="block px-4 py-3 font-medium transition-colors {isActive(link.href)
						? 'bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
						: 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}"
				>
					{link.icon} {link.label}
				</a>
			{/each}
			<hr class="my-2 mx-4 border-gray-200 dark:border-gray-700" />
			<button
				onclick={toggleDarkMode}
				class="block w-full text-left px-4 py-3 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
			>
				{darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
			</button>
			<button
				onclick={handleLogout}
				class="block w-full text-left px-4 py-3 text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700"
			>
				🚪 Logout
			</button>
		</div>
	{/if}
</nav>
