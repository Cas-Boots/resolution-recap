import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { 
	getEntriesForSeason,
	getEntriesForPerson,
	createEntry, 
	updateEntry, 
	softDeleteEntry, 
	softDeleteEntries,
	undeleteEntry,
	undeleteEntries,
	getActiveSeason,
	checkAndUnlockAchievements,
	ACHIEVEMENTS
} from '$lib/server/db';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (locals.role !== 'tracker' && locals.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const seasonId = url.searchParams.get('seasonId');
	const personId = url.searchParams.get('personId');
	const limit = url.searchParams.get('limit');
	const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
	const season = seasonId ? { id: parseInt(seasonId) } : getActiveSeason();
	
	if (!season) {
		return json({ error: 'No active season' }, { status: 400 });
	}

	// If personId is provided, return entries for that person
	if (personId) {
		const entries = getEntriesForPerson(season.id, parseInt(personId), limit ? parseInt(limit) : 20);
		return json(entries);
	}

	// Admin can see deleted entries, tracker cannot
	const showDeleted = locals.role === 'admin' && includeDeleted;
	const entries = getEntriesForSeason(season.id, showDeleted);
	
	// For admin, strip notes from response
	if (locals.role === 'admin') {
		const sanitized = entries.map(({ notes, ...rest }) => rest);
		return json(sanitized);
	}

	return json(entries);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (locals.role !== 'tracker') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { personId, metricId, entryDate, notes, tags } = await request.json();
	const season = getActiveSeason();
	
	if (!season) {
		return json({ error: 'No active season' }, { status: 400 });
	}

	const entry = createEntry(season.id, personId, metricId, entryDate, notes, tags, 'tracker');
	
	// Check for new achievements
	const newAchievements = checkAndUnlockAchievements(season.id, personId);
	const unlockedDetails = newAchievements.map(key => ACHIEVEMENTS.find(a => a.key === key)).filter(Boolean);
	
	return json({ ...entry, newAchievements: unlockedDetails }, { status: 201 });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (locals.role !== 'tracker' && locals.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id, personId, metricId, entryDate } = await request.json();
	updateEntry(id, personId, metricId, entryDate, locals.role || 'tracker');
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (locals.role !== 'tracker' && locals.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id, ids, action } = await request.json();
	const performedBy = locals.role || 'admin';
	
	// Support undelete action
	if (action === 'undelete') {
		if (ids && Array.isArray(ids)) {
			undeleteEntries(ids, performedBy);
		} else if (id) {
			undeleteEntry(id, performedBy);
		}
		return json({ success: true, action: 'undeleted' });
	}
	
	// Default: soft delete
	if (ids && Array.isArray(ids)) {
		softDeleteEntries(ids, performedBy);
	} else if (id) {
		softDeleteEntry(id, performedBy);
	}
	
	return json({ success: true, action: 'deleted' });
};
