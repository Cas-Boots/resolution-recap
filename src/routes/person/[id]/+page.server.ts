import type { PageServerLoad } from './$types';
import { getActiveSeason, getActiveMetrics, getActivePeople, getGoalsForSeason, getStreaks, getEntriesForSeasonInRange, getPersonAchievements, ACHIEVEMENTS, checkAndUnlockAchievements, getLegacyBadgesForPerson, getHistoricalSeasons, getPersonXPStats, getPersonalBests, getConsistencyScores, getCumulativeStats, getStreakWarnings, getSportStatsByPerson, getYearOverYearComparison, getPredictions } from '$lib/server/db';
import type { StreakData, PersonalBest, ConsistencyData } from '$lib/server/db';
import { getPlayerStats } from '$lib/leveling';
import { requireRole } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals, params }) => {
	requireRole(locals, 'tracker', 'admin');

	const personId = Number(params.id);
	if (!Number.isInteger(personId) || personId <= 0) {
		return { error: 'Invalid person ID' };
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
	
	// Get XP stats for leveling system
	const xpStats = getPersonXPStats(season.id, personId);
	const playerStats = getPlayerStats(xpStats);

	// Day-of-year helper for time-based aggregations
	const now = new Date();
	const yearStart = new Date(season.year, 0, 1);
	const currentDayOfYear = Math.floor((now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

	// New aggregations
	const allPersonalBests = getPersonalBests(season.id);
	const personalBests = allPersonalBests[personId] || [];

	const allConsistency = getConsistencyScores(season.id);
	const consistency = allConsistency.find(c => c.person_id === personId) || null;

	const allCumulative = getCumulativeStats(season.id);
	const cumulativeStats = allCumulative.filter(c => c.person_id === personId);

	const allStreakWarnings = getStreakWarnings(season.id);
	const streakWarnings = allStreakWarnings.filter(w => w.person_id === personId);

	const allSportStats = getSportStatsByPerson(season.id);
	const sportStats = allSportStats.find(s => s.person_id === personId) || null;

	// Build per-person day-of-week stats from personEntries (getDayOfWeekStats is global)
	const dayOfWeekCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
	for (const entry of personEntries) {
		const d = new Date(`${entry.entry_date}T00:00:00`).getDay();
		dayOfWeekCounts[d] = (dayOfWeekCounts[d] || 0) + 1;
	}
	const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const totalDayEntries = Object.values(dayOfWeekCounts).reduce((a, b) => a + b, 0);
	const dayOfWeekStats = dayNames.map((day, index) => ({
		day,
		dayIndex: index,
		count: dayOfWeekCounts[index],
		percentage: totalDayEntries > 0 ? Math.round((dayOfWeekCounts[index] / totalDayEntries) * 100) : 0
	}));

	const allYearOverYear = getYearOverYearComparison(season.id, currentDayOfYear);
	const yearOverYear = allYearOverYear.find(y => y.person_name === person.name) || null;

	const allPredictions = getPredictions(season.id, currentDayOfYear);
	const prediction = allPredictions.find(p => p.person_name === person.name) || null;

	return {
		authorized: true,
		role: locals.role,
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
		historicalSeasons,
		playerStats,
		// New fields:
		personalBests,
		consistency,
		cumulativeStats,
		streakWarnings,
		sportStats,
		dayOfWeekStats,
		yearOverYear,
		prediction
	};
};
