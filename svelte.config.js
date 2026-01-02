import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	// Suppress intentional warnings for capturing initial prop values
	compilerOptions: {
		warningFilter: (warning) => {
			// Suppress state_referenced_locally for intentional initial value captures
			if (warning.code === 'state_referenced_locally') return false;
			return true;
		}
	},

	kit: {
		adapter: adapter(),
		paths: {
			base: process.env.BASE_PATH || ''
		}
	}
};

export default config;
