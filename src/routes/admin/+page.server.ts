import type { PageServerLoad } from './$types';
import { getAllSeasons, getActiveSeason } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin');

	const seasons = getAllSeasons();
	const activeSeason = getActiveSeason();

	return {
		authorized: true,
		seasons,
		activeSeason
	};
};
