import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { type Locale, translations, type Translations } from '$lib/i18n';

function safeLocalStorage(action: () => string | null | void): string | null | void {
	try { return action(); } catch { return null; }
}

// Get initial locale from localStorage or browser preference
function getInitialLocale(): Locale {
	if (!browser) return 'en';

	const stored = safeLocalStorage(() => localStorage.getItem('locale'));
	if (stored === 'en' || stored === 'nl') return stored;

	const browserLang = navigator.language.toLowerCase();
	if (browserLang.startsWith('nl')) return 'nl';

	return 'en';
}

// Create the locale store
function createLocaleStore() {
	const { subscribe, set, update } = writable<Locale>(getInitialLocale());

	return {
		subscribe,
		set: (locale: Locale) => {
			if (browser) safeLocalStorage(() => localStorage.setItem('locale', locale));
			set(locale);
		},
		toggle: () => {
			update(current => {
				const newLocale = current === 'en' ? 'nl' : 'en';
				if (browser) safeLocalStorage(() => localStorage.setItem('locale', newLocale));
				return newLocale;
			});
		}
	};
}

export const locale = createLocaleStore();

// Derived store for current translations
export const t = derived(locale, ($locale) => translations[$locale]);

// Helper to get a translation value
export function getTranslation(translations: Translations, path: string): string {
	const keys = path.split('.');
	let value: unknown = translations;
	for (const key of keys) {
		value = (value as Record<string, unknown>)[key];
		if (value === undefined) return path;
	}
	return value as string;
}
