<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { locale, t } from '$lib/stores/locale';
	import type { Translations } from '$lib/i18n';

	interface Props {
		role: 'tracker' | 'admin';
		onLogout: () => void;
	}

	let { role, onLogout }: Props = $props();

	let menuOpen = $state(false);
	let darkMode = $state(false);
	let moreSheetOpen = $state(false);
	let currentLocale = $state<'en' | 'nl'>('en');
	let currentTranslations = $state<Translations | null>(null);

	// Subscribe to locale store
	$effect(() => {
		const unsubscribe = locale.subscribe(value => {
			currentLocale = value;
		});
		return unsubscribe;
	});

	// Subscribe to translations store
	$effect(() => {
		const unsubscribe = t.subscribe(value => {
			currentTranslations = value;
		});
		return unsubscribe;
	});

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

	function toggleLocale() {
		locale.toggle();
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

	// Primary links shown in bottom tab bar (mobile) / main nav (desktop)
	// Use $derived to make them reactive to translation changes
	const primaryLinks = $derived([
		{ href: `${base}/`, label: currentTranslations?.nav.home ?? 'Home', icon: '📊' },
		{ href: `${base}/add`, label: currentTranslations?.nav.add ?? 'Add', icon: '➕' },
		{ href: `${base}/stats`, label: currentTranslations?.nav.stats ?? 'Stats', icon: '📈' },
		{ href: `${base}/history`, label: currentTranslations?.nav.history ?? 'History', icon: '📜' }
	]);

	// Secondary links in "More" sheet
	const secondaryLinks = $derived([
		{ href: `${base}/countries`, label: currentTranslations?.nav.countries ?? 'Countries', icon: '🌍' },
		{ href: `${base}/teasers`, label: 'Teasers', icon: '📱' },
		{ href: `${base}/reveal`, label: 'Reveal', icon: '🎬' },
		{ href: `${base}/export`, label: 'Export', icon: '📄' },
		{ href: `${base}/settings`, label: currentTranslations?.nav.settings ?? 'Settings', icon: '⚙️' }
	]);

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

<!-- Desktop: Top navbar -->
<nav class="hidden md:block bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-40">
	<div class="max-w-6xl mx-auto px-6">
		<div class="flex items-center h-16 gap-6">
			<!-- Logo -->
			<a href={mainLinks[0].href} class="flex items-center gap-2 group shrink-0">
				<span class="text-2xl group-hover:scale-110 transition-transform">🎯</span>
				<span class="font-bold text-xl bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
					Recap
				</span>
			</a>

			<!-- Primary nav - pill container -->
			<div class="flex items-center bg-gray-100/80 dark:bg-gray-700/50 rounded-full p-1">
				{#each mainLinks as link}
					<a
						href={link.href}
						class="relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 {isActive(link.href)
							? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-300 shadow-sm'
							: 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}"
					>
						<span class="relative z-10 flex items-center gap-1.5">
							<span class="text-base">{link.icon}</span>
							<span>{link.label}</span>
						</span>
					</a>
				{/each}
			</div>

			<!-- Spacer -->
			<div class="flex-1"></div>

			<!-- Secondary nav - icon buttons -->
			{#if moreLinks.length > 0}
				<div class="flex items-center gap-1">
					{#each moreLinks as link}
						<a
							href={link.href}
							class="relative p-2.5 rounded-xl text-xl transition-all duration-200 group {isActive(link.href)
								? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300'
								: 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'}"
							title={link.label}
						>
							{link.icon}
							<!-- Tooltip -->
							<span class="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
								{link.label}
							</span>
						</a>
					{/each}
				</div>
				
				<!-- Divider -->
				<div class="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
			{/if}

			<!-- Right side actions -->
			<div class="flex items-center gap-1">
				<!-- Language toggle -->
				<button
					onclick={toggleLocale}
					class="relative p-2.5 rounded-xl text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 group"
					aria-label={currentLocale === 'en' ? 'Switch to Dutch' : 'Switch to English'}
					title={currentLocale === 'en' ? 'Nederlands' : 'English'}
				>
					{currentLocale === 'en' ? '🇬🇧' : '🇳🇱'}
				</button>
				
				<!-- Dark mode toggle -->
				<button
					onclick={toggleDarkMode}
					class="relative p-2.5 rounded-xl text-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 group"
					aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
					title={darkMode ? 'Light mode' : 'Dark mode'}
				>
					<span class="block transition-transform duration-500 {darkMode ? 'rotate-0' : 'rotate-[360deg]'}">
						{darkMode ? '☀️' : '🌙'}
					</span>
				</button>
				
				<!-- Logout -->
				<button
					onclick={handleLogout}
					class="relative p-2.5 rounded-xl text-xl text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 group"
					title="Logout"
				>
					🚪
					<!-- Tooltip -->
					<span class="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
						Logout
					</span>
				</button>
			</div>
		</div>
	</div>
</nav>

<!-- Mobile: Bottom tab bar -->
<nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 safe-area-bottom">
	<div class="flex justify-around items-center h-16 px-2">
		{#each mainLinks as link}
			<a
				href={link.href}
				class="flex flex-col items-center justify-center flex-1 py-2 transition-colors {isActive(link.href)
					? 'text-indigo-600 dark:text-indigo-400'
					: 'text-gray-500 dark:text-gray-400'}"
			>
				<span class="text-xl mb-0.5">{link.icon}</span>
				<span class="text-[10px] font-medium">{link.label}</span>
			</a>
		{/each}
		
		<!-- More button -->
		{#if moreLinks.length > 0}
			<button
				onclick={() => moreSheetOpen = true}
				class="flex flex-col items-center justify-center flex-1 py-2 transition-colors {isMoreActive()
					? 'text-indigo-600 dark:text-indigo-400'
					: 'text-gray-500 dark:text-gray-400'}"
			>
				<span class="text-xl mb-0.5">⋯</span>
				<span class="text-[10px] font-medium">More</span>
			</button>
		{:else}
			<!-- Admin logout -->
			<button
				onclick={handleLogout}
				class="flex flex-col items-center justify-center flex-1 py-2 text-gray-500 dark:text-gray-400"
			>
				<span class="text-xl mb-0.5">🚪</span>
				<span class="text-[10px] font-medium">Logout</span>
			</button>
		{/if}
	</div>
</nav>

<!-- Mobile: Bottom sheet for "More" menu -->
{#if moreSheetOpen}
	<!-- Backdrop -->
	<button
		class="md:hidden fixed inset-0 bg-black/50 z-50 transition-opacity"
		onclick={() => moreSheetOpen = false}
		aria-label="Close menu"
	></button>
	
	<!-- Sheet -->
	<div class="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl z-50 shadow-2xl animate-slide-up safe-area-bottom">
		<!-- Handle bar -->
		<div class="flex justify-center pt-3 pb-2">
			<div class="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
		</div>
		
		<!-- Menu items grid -->
		<div class="grid grid-cols-3 gap-2 p-4 pb-2">
			{#each moreLinks as link}
				<a
					href={link.href}
					onclick={() => moreSheetOpen = false}
					class="flex flex-col items-center justify-center py-4 rounded-xl transition-colors {isActive(link.href)
						? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
						: 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
				>
					<span class="text-2xl mb-1">{link.icon}</span>
					<span class="text-xs font-medium">{link.label}</span>
				</a>
			{/each}
		</div>
		
		<!-- Bottom actions -->
		<div class="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 mb-2">
			<button
				onclick={toggleLocale}
				class="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
			>
				<span class="text-lg">{currentLocale === 'en' ? '🇬🇧' : '🇳🇱'}</span>
				<span class="text-sm font-medium">{currentLocale === 'en' ? 'EN' : 'NL'}</span>
			</button>
			
			<button
				onclick={toggleDarkMode}
				class="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
			>
				<span class="text-lg">{darkMode ? '☀️' : '🌙'}</span>
				<span class="text-sm font-medium">{darkMode ? 'Light' : 'Dark'}</span>
			</button>
			
			<button
				onclick={() => { handleLogout(); moreSheetOpen = false; }}
				class="flex items-center gap-2 px-4 py-2 rounded-xl text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
			>
				<span class="text-lg">🚪</span>
				<span class="text-sm font-medium">Logout</span>
			</button>
		</div>
	</div>
{/if}

<style>
	/* Safe area for devices with home indicator */
	.safe-area-bottom {
		padding-bottom: env(safe-area-inset-bottom, 0);
	}
	
	/* Slide up animation for bottom sheet */
	@keyframes slide-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
	
	.animate-slide-up {
		animation: slide-up 0.3s ease-out;
	}
</style>
