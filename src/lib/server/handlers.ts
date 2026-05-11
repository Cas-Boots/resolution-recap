import { json } from '@sveltejs/kit';
import { getActiveSeason } from '$lib/server/db';
import type { Season } from '$lib/server/db';

/** Returns a 401 Response if `locals.role` is not one of the required roles; null otherwise. */
export function checkAuth(
	locals: App.Locals,
	...roles: ('tracker' | 'admin')[]
): Response | null {
	if (!roles.some((r) => r === locals.role)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	return null;
}

/** Returns the active season, or a 400 Response if none is set. */
export function getSeasonOrError(): { season: Season; error: null } | { season: null; error: Response } {
	const season = getActiveSeason();
	if (!season) return { season: null, error: json({ error: 'No active season' }, { status: 400 }) };
	return { season, error: null };
}
