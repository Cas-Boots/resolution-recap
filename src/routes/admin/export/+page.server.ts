import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.role !== 'admin') {
		return { authorized: false };
	}

	return {
		authorized: true
	};
};
