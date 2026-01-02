import type { PageServerLoad } from './$types';
import { getActiveSeason, getActiveMetrics, getActivePeople, getGoalsForSeason, getStreaks, getEntriesForSeasonInRange, getPersonAchievements, ACHIEVEMENTS, checkAndUnlockAchievements, getLegacyBadgesForPerson, getHistoricalSeasons } from '$lib/server/db';
import type { StreakData } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (locals.role !== 'tracker') {
		return { authorized: false };
	}

	const personId = parseInt(params.id);
	if (isNaN(personId)) {
		return { authorized: true, error: 'Invalid person ID' };
	}

	const season = getActiveSeason();
	if (!season) {
		return { authorized: true, season: null };
	}

	const metrics = getActiveMetrics();
	const people = getActivePeople();
	const person = people.find(p => p.id === personId);
	
	if (!person) {
		return { authorized: true, error: 'Person not found' };
	}

	const goals = getGoalsForSeason(season.id).filter(g => g.person_id === personId);
	
	// Get all entries for this person this year
	const allEntries = getEntriesForSeasonInRange(season.id, `${season.year}-01-01`, `${season.year}-12-31`);
	const personEntries = allEntries.filter(e => e.person_id === personId);
	
	// Get streaks for each metric
	const streaks: Record<number, StreakData | undefined> = {};
	for (const metric of metrics) {
		const metricStreaks = getStreaks(season.id, metric.id);
		streaks[metric.id] = metricStreaks.find(s => s.person_id === personId);
	}

	// Build calendar data - count entries per day
	const calendarData: Record<string, { total: number; byMetric: Record<string, number> }> = {};
	for (const entry of personEntries) {
		if (!calendarData[entry.entry_date]) {
			calendarData[entry.entry_date] = { total: 0, byMetric: {} };
		}
		calendarData[entry.entry_date].total++;
		calendarData[entry.entry_date].byMetric[entry.metric_name] = 
			(calendarData[entry.entry_date].byMetric[entry.metric_name] || 0) + 1;
	}

	// Calculate comparison with others
	const otherPeople = people.filter(p => p.id !== personId);
	const comparisons: { personId: number; personName: string; personEmoji: string; metrics: Record<string, number>; total: number }[] = [];
	
	for (const other of otherPeople) {
		const otherEntries = allEntries.filter(e => e.person_id === other.id);
		const metrics: Record<string, number> = {};
		for (const entry of otherEntries) {
			metrics[entry.metric_name] = (metrics[entry.metric_name] || 0) + 1;
		}
		comparisons.push({
			personId: other.id,
			personName: other.name,
			personEmoji: other.emoji,
			metrics,
			total: otherEntries.length
		});
	}

	// Check and update achievements
	checkAndUnlockAchievements(season.id, personId);
	const unlockedAchievements = getPersonAchievements(season.id, personId);
	
	// Get legacy badges from historical seasons
	const legacyBadges = getLegacyBadgesForPerson(person.name);
	const historicalSeasons = getHistoricalSeasons();
	
	return {
		authorized: true,
		season,
		person,
		people,
		metrics,
		goals,
		streaks,
		entries: personEntries,
		calendarData,
		comparisons,
		achievements: unlockedAchievements,
		allAchievements: ACHIEVEMENTS,
		legacyBadges,
		historicalSeasons
	};
};
