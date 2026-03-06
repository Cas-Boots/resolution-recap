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

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.role !== 'tracker') {
		return { authorized: false };
	}

	const activeTabParam = url.searchParams.get('tab');
	const activeTab = (activeTabParam && ['seasons', 'alltime', 'compare', 'predictions', 'timeline'].includes(activeTabParam))
		? activeTabParam as 'seasons' | 'alltime' | 'compare' | 'predictions' | 'timeline'
		: 'seasons';

	const needsHistoricalSeasons = activeTab === 'seasons' || activeTab === 'compare';
	const needsAllTime = activeTab === 'alltime';
	const needsTimeline = activeTab === 'timeline';
	const needsPredictions = activeTab === 'predictions';
	const needsPeople = activeTab === 'alltime';

	const historicalSeasons = needsHistoricalSeasons ? getHistoricalSeasons() : [];
	const allTimeLeaderboard = needsAllTime ? getAllTimeLeaderboard() : [];
	const timelineData = needsTimeline ? getTimelineData() : { years: [], people: [] };
	const people = needsPeople ? getActivePeople() : [];
	const season = needsPredictions ? getActiveSeason() : null;
	
	// Calculate day of year
	const now = new Date();
	const startOfYear = new Date(now.getFullYear(), 0, 1);
	const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
	
	// Get comparison and prediction data if we have an active season
	let yearOverYear: ReturnType<typeof getYearOverYearComparison> = [];
	let personalRecords: ReturnType<typeof getPersonalRecords> = [];
	let predictions: ReturnType<typeof getPredictions> = [];
	
	if (needsPredictions && season) {
		yearOverYear = getYearOverYearComparison(season.id, dayOfYear);
		personalRecords = getPersonalRecords(season.id, dayOfYear);
		predictions = getPredictions(season.id, dayOfYear);
	}
	
	// Get legacy badges for each person
	const legacyBadges: Record<string, ReturnType<typeof getLegacyBadgesForPerson>> = {};
	if (needsAllTime) {
		for (const person of people) {
			legacyBadges[person.name] = getLegacyBadgesForPerson(person.name);
		}
	}

	return {
		authorized: true,
		activeTab,
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
