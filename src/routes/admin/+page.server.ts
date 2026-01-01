import type { PageServerLoad } from './$types';
import { getAllSeasons, getActiveSeason } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.role !== 'admin') {
		return { authorized: false };
	}

	const seasons = getAllSeasons();
	const activeSeason = getActiveSeason();

	return {
		authorized: true,
		seasons,
		activeSeason
	};
};
