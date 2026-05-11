import { browser } from '$app/environment';
import { type Locale, translations, type Translations } from '$lib/i18n';

function safeLocalStorage(action: () => string | null | void): string | null | void {
	try { return action(); } catch { return null; }
}

function getInitialLocale(): Locale {
	if (!browser) return 'en';

	const stored = safeLocalStorage(() => localStorage.getItem('locale'));
	if (stored === 'en' || stored === 'nl') return stored;

	const browserLang = navigator.language.toLowerCase();
	if (browserLang.startsWith('nl')) return 'nl';

	return 'en';
}

export let locale = $state<Locale>(getInitialLocale());

export const t = $derived(translations[locale]);

export function setLocale(value: Locale) {
	if (browser) safeLocalStorage(() => localStorage.setItem('locale', value));
	locale = value;
}

export function toggleLocale() {
	const next: Locale = locale === 'en' ? 'nl' : 'en';
	if (browser) safeLocalStorage(() => localStorage.setItem('locale', next));
	locale = next;
}

export function getTranslation(transl: Translations, path: string): string {
	const keys = path.split('.');
	let value: unknown = transl;
	for (const key of keys) {
		value = (value as Record<string, unknown>)[key];
		if (value === undefined) return path;
	}
	return value as string;
}
