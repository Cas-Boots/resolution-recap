import type { PageServerLoad } from './$types';
import {
	getActiveSeason, getActivePeople, getActiveMetrics,
	getConsistencyScores, getStreakWarnings, getPredictions,
	getEntriesForSeasonInRange, getGoalsForSeason, getStreaks
} from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.role !== 'admin') {
		return { authorized: false };
	}

	const season = getActiveSeason();
	if (!season) {
		return { authorized: true, season: null, participants: [] };
	}

	const people = getActivePeople();
	const metrics = getActiveMetrics();
	const now = new Date();

	// Current day of year
	const yearStart = new Date(season.year, 0, 1);
	const currentDayOfYear = Math.floor((now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

	// Get all aggregations
	const allEntries = getEntriesForSeasonInRange(season.id, `${season.year}-01-01`, `${season.year}-12-31`);
	const goals = getGoalsForSeason(season.id);
	const consistency = getConsistencyScores(season.id);
	const streakWarnings = getStreakWarnings(season.id);
	const predictions = getPredictions(season.id, currentDayOfYear);

	// Get streaks for each person (use max current_daily_streak across all metrics)
	const allStreaks: Map<number, number> = new Map(); // person_id → current_daily_streak
	for (const metric of metrics) {
		const metricStreaks = getStreaks(season.id, metric.id);
		for (const streak of metricStreaks) {
			const existing = allStreaks.get(streak.person_id) || 0;
			allStreaks.set(streak.person_id, Math.max(existing, streak.current_daily_streak));
		}
	}

	// Build per-person participant data
	const participants = people.map(person => {
		const personEntries = allEntries.filter(e => e.person_id === person.id);
		const totalEntries = personEntries.length;

		// Last entry date
		const lastEntry = personEntries.length > 0
			? personEntries.reduce((latest, e) => e.entry_date > latest ? e.entry_date : latest, personEntries[0].entry_date)
			: null;

		// Days since last entry
		const daysSinceLastEntry = lastEntry
			? Math.floor((now.getTime() - new Date(`${lastEntry}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24))
			: null;

		const personGoals = goals.filter(g => g.person_id === person.id);
		const totalGoalTarget = personGoals.reduce((sum, g) => sum + g.target, 0);
		const goalCompletion = totalGoalTarget > 0
			? Math.min(100, Math.round((totalEntries / totalGoalTarget) * 100))
			: null;

		const personConsistency = consistency.find(c => c.person_id === person.id);
		const hasStreakWarning = streakWarnings.some(w => w.person_id === person.id);
		const prediction = predictions.find(p => p.person_name === person.name);
		const currentStreak = allStreaks.get(person.id) || 0;

		// Health status: red if 14+ days inactive, amber if streak warning or low consistency, green otherwise
		let status: 'healthy' | 'warning' | 'inactive' = 'healthy';
		if (daysSinceLastEntry !== null && daysSinceLastEntry >= 14) {
			status = 'inactive';
		} else if (hasStreakWarning || (personConsistency && personConsistency.consistency_percentage < 50)) {
			status = 'warning';
		}

		return {
			id: person.id,
			name: person.name,
			emoji: person.emoji,
			totalEntries,
			currentStreak,
			consistencyPercentage: personConsistency?.consistency_percentage ?? null,
			goalCompletion,
			lastEntry,
			daysSinceLastEntry,
			prediction: prediction ? { projected_final: prediction.projected_final, confidence: prediction.confidence } : null,
			hasStreakWarning,
			status
		};
	});

	return {
		authorized: true,
		season,
		metrics,
		participants
	};
};
