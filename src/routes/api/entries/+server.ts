import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as v from 'valibot';
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
	getAllMetrics,
	checkAndUnlockAchievements,
	ACHIEVEMENTS
} from '$lib/server/db';
import { checkAuth, getSeasonOrError } from '$lib/server/handlers';
import { EntryCreateSchema, EntryUpdateSchema, EntryDeleteSchema } from '$lib/server/schemas';

function parseTagList(rawTags: unknown): string[] {
	if (rawTags === undefined || rawTags === null) return [];

	if (Array.isArray(rawTags)) {
		return rawTags
			.map((tag) => String(tag).trim())
			.filter(Boolean);
	}

	const value = String(rawTags).trim();
	if (!value) return [];

	try {
		const parsed = JSON.parse(value);
		if (Array.isArray(parsed)) {
			return parsed
				.map((tag) => String(tag).trim())
				.filter(Boolean);
		}
	} catch {
		// fallback to comma-separated parsing
	}

	return value
		.split(',')
		.map((tag) => tag.trim())
		.filter(Boolean);
}

function normalizeSingleSportTag(metricId: number, rawTags: unknown): { ok: true; tags: string | null } | { ok: false; error: string } {
	const metric = getAllMetrics().find((item) => item.id === metricId);
	const isSporting = (metric?.name || '').toLowerCase() === 'sporting';
	const parsedTags = parseTagList(rawTags);

	if (!isSporting) {
		return { ok: true, tags: parsedTags.length > 0 ? parsedTags.join(',') : null };
	}

	if (parsedTags.length === 0) {
		return {
			ok: false,
			error: 'Sporting entries require exactly one activity type.'
		};
	}

	if (parsedTags.length > 1) {
		return {
			ok: false,
			error: 'Only one sporting activity is allowed per entry. Add separate entries for multiple activities.'
		};
	}

	return { ok: true, tags: parsedTags[0] || null };
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const deny = checkAuth(locals, 'tracker', 'admin');
	if (deny) return deny;

	const seasonId = url.searchParams.get('seasonId');
	const personId = url.searchParams.get('personId');
	const limit = url.searchParams.get('limit');
	const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
	const parsedSeasonId = seasonId ? parseInt(seasonId) : NaN;
	if (seasonId && !Number.isFinite(parsedSeasonId)) {
		return json({ error: 'Invalid seasonId' }, { status: 400 });
	}
	const season = seasonId ? { id: parsedSeasonId } : getActiveSeason();

	if (!season) {
		return json({ error: 'No active season' }, { status: 400 });
	}

	// If personId is provided, return entries for that person
	if (personId) {
		const parsedPersonId = parseInt(personId);
		if (!Number.isFinite(parsedPersonId)) {
			return json({ error: 'Invalid personId' }, { status: 400 });
		}
		const entries = getEntriesForPerson(season.id, parsedPersonId, limit ? parseInt(limit) : 20);
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
	const deny = checkAuth(locals, 'tracker');
	if (deny) return deny;

	const parsed = v.safeParse(EntryCreateSchema, await request.json());
	if (!parsed.success) return json({ error: 'Invalid input', issues: v.flatten(parsed.issues) }, { status: 400 });
	const { personId, metricId, entryDate, notes, tags } = parsed.output;

	const { season, error: seasonError } = getSeasonOrError();
	if (seasonError) return seasonError;

	const normalized = normalizeSingleSportTag(metricId, tags);
	if (!normalized.ok) {
		return json({ error: normalized.error }, { status: 400 });
	}

	const entry = createEntry(season.id, personId, metricId, entryDate, notes, normalized.tags || undefined, 'tracker');
	
	// Check for new achievements
	const newAchievements = checkAndUnlockAchievements(season.id, personId);
	const unlockedDetails = newAchievements.map(key => ACHIEVEMENTS.find(a => a.key === key)).filter(Boolean);
	
	return json({ ...entry, newAchievements: unlockedDetails }, { status: 201 });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const deny = checkAuth(locals, 'tracker', 'admin');
	if (deny) return deny;

	const parsed = v.safeParse(EntryUpdateSchema, await request.json());
	if (!parsed.success) return json({ error: 'Invalid input', issues: v.flatten(parsed.issues) }, { status: 400 });
	const { id, personId, metricId, entryDate, tags } = parsed.output;
	const normalized = normalizeSingleSportTag(metricId, tags);
	if (!normalized.ok) {
		return json({ error: normalized.error }, { status: 400 });
	}

	updateEntry(id, personId, metricId, entryDate, locals.role || 'tracker', normalized.tags);
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const deny = checkAuth(locals, 'tracker', 'admin');
	if (deny) return deny;

	const parsed = v.safeParse(EntryDeleteSchema, await request.json());
	if (!parsed.success) return json({ error: 'Invalid input', issues: v.flatten(parsed.issues) }, { status: 400 });
	const { id, ids, action } = parsed.output;
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
