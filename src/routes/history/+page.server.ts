import type { PageServerLoad } from './$types';
import { 
	getHistoricalSeasons, 
	getAllTimeLeaderboard,
	getLegacyBadgesForPerson,
	getTimelineData,
	getHeadToHeadHistory,
	getYearOverYearComparison,
	getPersonalRecords,
	getPredictions,
	getActiveSeason,
	getActivePeople
} from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.role !== 'tracker') {
		return { authorized: false };
	}

	const historicalSeasons = getHistoricalSeasons();
	const allTimeLeaderboard = getAllTimeLeaderboard();
	const timelineData = getTimelineData();
	const people = getActivePeople();
	const season = getActiveSeason();
	
	// Calculate day of year
	const now = new Date();
	const startOfYear = new Date(now.getFullYear(), 0, 1);
	const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
	
	// Get comparison and prediction data if we have an active season
	let yearOverYear: ReturnType<typeof getYearOverYearComparison> = [];
	let personalRecords: ReturnType<typeof getPersonalRecords> = [];
	let predictions: ReturnType<typeof getPredictions> = [];
	
	if (season) {
		yearOverYear = getYearOverYearComparison(season.id, dayOfYear);
		personalRecords = getPersonalRecords(season.id, dayOfYear);
		predictions = getPredictions(season.id, dayOfYear);
	}
	
	// Get legacy badges for each person
	const legacyBadges: Record<string, ReturnType<typeof getLegacyBadgesForPerson>> = {};
	for (const person of people) {
		legacyBadges[person.name] = getLegacyBadgesForPerson(person.name);
	}

	return {
		authorized: true,
		historicalSeasons,
		allTimeLeaderboard,
		timelineData,
		legacyBadges,
		yearOverYear,
		personalRecords,
		predictions,
		people,
		season,
		dayOfYear
	};
};
