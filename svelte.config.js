import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	// Suppressed globally: pages seed $state from the server `data` prop as an initial value,
	// then manage it client-side (tab selection, secondary fetch results, form fields, etc.).
	// Wrapping in $derived would reset UI state on every navigation — intentionally avoided.
	compilerOptions: {
		warningFilter: (warning) => warning.code !== 'state_referenced_locally'
	},

	kit: {
		adapter: adapter(),
		paths: {
			base: process.env.BASE_PATH || ''
		}
	}
};

export default config;
