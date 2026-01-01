import type { PageServerLoad } from './$types';
import { getActiveSeason, getSeasonStatsInRange, getActiveMetrics, getActivePeople, getGoalsForSeason, getMonthlyStats, getStreaks, getEntriesForSeason, getCountriesStats } from '$lib/server/db';
import type { StreakData } from '$lib/server/db';

export interface Award {
	id: string;
	title: string;
	emoji: string;
	personName: string;
	personEmoji: string;
	description: string;
	value?: string;
}

export interface TriviaQuestion {
	id: string;
	question: string;
	answer: string;
	hint?: string;
	category: 'person' | 'metric' | 'streak' | 'general' | 'travel';
}

function generateAwards(
	stats: { person_id: number; person_name: string; person_emoji: string; metric_name: string; count: number }[],
	streaks: Record<number, StreakData[]>,
	monthlyStats: { month: string; person_name: string; metric_name: string; count: number }[],
	metrics: { id: number; name: string; emoji: string }[],
	countriesStats: { person_id: number; person_name: string; person_emoji: string; country_count: number; countries: string[] }[]
): Award[] {
	const awards: Award[] = [];
	
	// Group stats by person
	const personTotals = new Map<string, { name: string; emoji: string; total: number; metrics: Record<string, number> }>();
	for (const stat of stats) {
		if (!personTotals.has(stat.person_name)) {
			personTotals.set(stat.person_name, { name: stat.person_name, emoji: stat.person_emoji, total: 0, metrics: {} });
		}
		const person = personTotals.get(stat.person_name)!;
		person.total += stat.count;
		person.metrics[stat.metric_name] = (person.metrics[stat.metric_name] || 0) + stat.count;
	}
	
	const sortedByTotal = [...personTotals.values()].sort((a, b) => b.total - a.total);
	
	// Most Traveled - person who visited the most countries
	if (countriesStats.length > 0 && countriesStats[0].country_count > 0) {
		const topTraveler = countriesStats[0];
		awards.push({
			id: 'most-traveled',
			title: 'World Traveler',
			emoji: '🌍',
			personName: topTraveler.person_name,
			personEmoji: topTraveler.person_emoji,
			description: 'Visited the most countries this year',
			value: `${topTraveler.country_count} countries`
		});
	}
	
	// Most Active Overall
	if (sortedByTotal.length > 0 && sortedByTotal[0].total > 0) {
		awards.push({
			id: 'most-active',
			title: 'Most Active',
			emoji: '🏆',
			personName: sortedByTotal[0].name,
			personEmoji: sortedByTotal[0].emoji,
			description: 'Most total entries across all metrics',
			value: `${sortedByTotal[0].total} entries`
		});
	}
	
	// Per-metric champions
	for (const metric of metrics) {
		const metricStats = stats.filter(s => s.metric_name === metric.name).sort((a, b) => b.count - a.count);
		if (metricStats.length > 0 && metricStats[0].count > 0) {
			awards.push({
				id: `${metric.name.toLowerCase()}-champion`,
				title: `${metric.name} Champion`,
				emoji: metric.emoji,
				personName: metricStats[0].person_name,
				personEmoji: metricStats[0].person_emoji,
				description: `Most ${metric.name.toLowerCase()} entries`,
				value: `${metricStats[0].count} times`
			});
		}
	}
	
	// Streak awards per metric
	for (const metric of metrics) {
		const metricStreaks = streaks[metric.id] || [];
		
		// Longest daily streak
		const dailyChamp = [...metricStreaks].sort((a, b) => b.longest_daily_streak - a.longest_daily_streak)[0];
		if (dailyChamp && dailyChamp.longest_daily_streak > 1) {
			awards.push({
				id: `${metric.name.toLowerCase()}-daily-streak`,
				title: `${metric.name} Streak Master`,
				emoji: '🔥',
				personName: dailyChamp.person_name,
				personEmoji: dailyChamp.person_emoji,
				description: `Longest consecutive days of ${metric.name.toLowerCase()}`,
				value: `${dailyChamp.longest_daily_streak} days in a row`
			});
		}
		
		// Most consistent (highest weekly streak)
		const weeklyChamp = [...metricStreaks].sort((a, b) => b.longest_weekly_streak - a.longest_weekly_streak)[0];
		if (weeklyChamp && weeklyChamp.longest_weekly_streak > 2) {
			awards.push({
				id: `${metric.name.toLowerCase()}-consistent`,
				title: `${metric.name} Consistency King`,
				emoji: '📅',
				personName: weeklyChamp.person_name,
				personEmoji: weeklyChamp.person_emoji,
				description: `Most consistent weekly ${metric.name.toLowerCase()}`,
				value: `${weeklyChamp.longest_weekly_streak} weeks straight`
			});
		}
	}
	
	// Weekend Warrior - need to analyze entries by day of week
	const dayOfWeekCounts = new Map<string, Map<string, number>>();
	for (const stat of monthlyStats) {
		// We don't have day of week here, but we can infer from streaks
	}
	
	// Early Bird vs Night Owl would need entry time data
	
	// Best Month
	const monthTotals = new Map<string, { month: string; total: number }>();
	for (const stat of monthlyStats) {
		const key = stat.month;
		if (!monthTotals.has(key)) {
			monthTotals.set(key, { month: key, total: 0 });
		}
		monthTotals.get(key)!.total += stat.count;
	}
	const sortedMonths = [...monthTotals.values()].sort((a, b) => b.total - a.total);
	
	// Late Bloomer - most improvement in second half
	const firstHalf = monthlyStats.filter(s => parseInt(s.month.split('-')[1]) <= 6);
	const secondHalf = monthlyStats.filter(s => parseInt(s.month.split('-')[1]) > 6);
	
	const personFirstHalf = new Map<string, number>();
	const personSecondHalf = new Map<string, number>();
	
	for (const stat of firstHalf) {
		personFirstHalf.set(stat.person_name, (personFirstHalf.get(stat.person_name) || 0) + stat.count);
	}
	for (const stat of secondHalf) {
		personSecondHalf.set(stat.person_name, (personSecondHalf.get(stat.person_name) || 0) + stat.count);
	}
	
	let maxImprovement = 0;
	let lateBlocker: { name: string; emoji: string; improvement: number } | null = null;
	
	for (const [name, secondCount] of personSecondHalf) {
		const firstCount = personFirstHalf.get(name) || 0;
		const improvement = secondCount - firstCount;
		if (improvement > maxImprovement && secondCount > 0) {
			maxImprovement = improvement;
			const person = personTotals.get(name);
			if (person) {
				lateBlocker = { name, emoji: person.emoji, improvement };
			}
		}
	}
	
	if (lateBlocker && lateBlocker.improvement > 5) {
		awards.push({
			id: 'late-bloomer',
			title: 'Late Bloomer',
			emoji: '🌸',
			personName: lateBlocker.name,
			personEmoji: lateBlocker.emoji,
			description: 'Most improvement in the second half of the year',
			value: `+${lateBlocker.improvement} more entries`
		});
	}
	
	// Early Starter - most activity in January
	const januaryStats = monthlyStats.filter(s => s.month.endsWith('-01'));
	const januaryTotals = new Map<string, number>();
	for (const stat of januaryStats) {
		januaryTotals.set(stat.person_name, (januaryTotals.get(stat.person_name) || 0) + stat.count);
	}
	const earlyStarter = [...januaryTotals.entries()].sort((a, b) => b[1] - a[1])[0];
	if (earlyStarter && earlyStarter[1] > 3) {
		const person = personTotals.get(earlyStarter[0]);
		if (person) {
			awards.push({
				id: 'early-starter',
				title: 'New Year Enthusiast',
				emoji: '🎉',
				personName: person.name,
				personEmoji: person.emoji,
				description: 'Most active in January',
				value: `${earlyStarter[1]} entries in January`
			});
		}
	}
	
	// Fun awards based on specific patterns
	// Perfectionist - hit their goal exactly or exceeded by small margin
	
	return awards;
}

function generateTrivia(
	stats: { person_id: number; person_name: string; person_emoji: string; metric_name: string; count: number }[],
	streaks: Record<number, StreakData[]>,
	monthlyStats: { month: string; person_name: string; metric_name: string; count: number }[],
	metrics: { id: number; name: string; emoji: string }[],
	people: { id: number; name: string; emoji: string }[],
	countriesStats: { person_id: number; person_name: string; person_emoji: string; country_count: number; countries: string[] }[]
): TriviaQuestion[] {
	const trivia: TriviaQuestion[] = [];
	const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	
	// Countries trivia questions
	const totalCountries = countriesStats.reduce((sum, s) => sum + s.country_count, 0);
	const uniqueCountries = new Set(countriesStats.flatMap(s => s.countries));
	
	if (countriesStats.length > 0 && countriesStats[0].country_count > 0) {
		trivia.push({
			id: 'most-traveled-person',
			question: 'Who visited the most countries this year?',
			answer: countriesStats[0].person_name,
			hint: `They visited ${countriesStats[0].country_count} countries`,
			category: 'travel'
		});
		
		trivia.push({
			id: 'most-traveled-count',
			question: `How many countries did ${countriesStats[0].person_name} visit?`,
			answer: countriesStats[0].country_count.toString(),
			hint: countriesStats[0].countries.slice(0, 2).join(', ') + '...',
			category: 'travel'
		});
	}
	
	if (uniqueCountries.size > 0) {
		trivia.push({
			id: 'total-unique-countries',
			question: 'How many unique countries did the group visit in total?',
			answer: uniqueCountries.size.toString(),
			hint: uniqueCountries.size > 5 ? 'More than 5!' : 'Less than 6',
			category: 'travel'
		});
	}

	// Total entries question
	const totalEntries = stats.reduce((sum, s) => sum + s.count, 0);
	if (totalEntries > 0) {
		trivia.push({
			id: 'total-entries',
			question: 'How many total entries were logged this year?',
			answer: totalEntries.toString(),
			hint: totalEntries > 100 ? 'More than 100!' : 'Less than 100',
			category: 'general'
		});
	}
	
	// Per-metric totals
	for (const metric of metrics) {
		const metricTotal = stats.filter(s => s.metric_name === metric.name).reduce((sum, s) => sum + s.count, 0);
		if (metricTotal > 0) {
			trivia.push({
				id: `total-${metric.name.toLowerCase()}`,
				question: `How many times did the group ${metric.name.toLowerCase()} in total?`,
				answer: metricTotal.toString(),
				category: 'metric'
			});
			
			// Who did most
			const metricStats = stats.filter(s => s.metric_name === metric.name).sort((a, b) => b.count - a.count);
			if (metricStats.length > 0 && metricStats[0].count > 0) {
				trivia.push({
					id: `who-most-${metric.name.toLowerCase()}`,
					question: `Who logged the most ${metric.name.toLowerCase()}?`,
					answer: metricStats[0].person_name,
					hint: `They did it ${metricStats[0].count} times`,
					category: 'person'
				});
			}
		}
	}
	
	// Streak questions
	for (const metric of metrics) {
		const metricStreaks = streaks[metric.id] || [];
		const dailyChamp = [...metricStreaks].sort((a, b) => b.longest_daily_streak - a.longest_daily_streak)[0];
		if (dailyChamp && dailyChamp.longest_daily_streak > 2) {
			trivia.push({
				id: `streak-${metric.name.toLowerCase()}`,
				question: `What was the longest ${metric.name.toLowerCase()} streak in consecutive days?`,
				answer: `${dailyChamp.longest_daily_streak} days by ${dailyChamp.person_name}`,
				category: 'streak'
			});
		}
	}
	
	// Best month question
	const monthTotals = new Map<string, number>();
	for (const stat of monthlyStats) {
		monthTotals.set(stat.month, (monthTotals.get(stat.month) || 0) + stat.count);
	}
	const sortedMonths = [...monthTotals.entries()].sort((a, b) => b[1] - a[1]);
	if (sortedMonths.length > 0) {
		const [bestMonth, count] = sortedMonths[0];
		const monthNum = parseInt(bestMonth.split('-')[1]);
		trivia.push({
			id: 'best-month',
			question: 'Which month had the most total activity?',
			answer: monthNames[monthNum],
			hint: `${count} total entries that month`,
			category: 'general'
		});
	}
	
	// Comparison questions
	if (people.length >= 2) {
		const personTotals = new Map<string, number>();
		for (const stat of stats) {
			personTotals.set(stat.person_name, (personTotals.get(stat.person_name) || 0) + stat.count);
		}
		const sorted = [...personTotals.entries()].sort((a, b) => b[1] - a[1]);
		
		if (sorted.length >= 2) {
			const [first, firstCount] = sorted[0];
			const [second, secondCount] = sorted[1];
			const diff = firstCount - secondCount;
			
			trivia.push({
				id: 'closest-race',
				question: `By how many entries did ${first} beat ${second}?`,
				answer: diff.toString(),
				category: 'general'
			});
		}
	}
	
	return trivia;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.role !== 'tracker') {
		return { authorized: false };
	}

	const season = getActiveSeason();
	if (!season) {
		return { authorized: true, season: null };
	}

	const metrics = getActiveMetrics();
	const people = getActivePeople();
	const stats = getSeasonStatsInRange(season.id, `${season.year}-01-01`, `${season.year}-12-31`);
	const goals = getGoalsForSeason(season.id);
	const monthlyStats = getMonthlyStats(season.id);
	const entries = getEntriesForSeason(season.id);
	const countriesStats = getCountriesStats(season.id);
	
	// Get streaks for each metric
	const streaks: Record<number, StreakData[]> = {};
	for (const metric of metrics) {
		streaks[metric.id] = getStreaks(season.id, metric.id);
	}

	const awards = generateAwards(stats, streaks, monthlyStats, metrics, countriesStats);
	const trivia = generateTrivia(stats, streaks, monthlyStats, metrics, people, countriesStats);

	return {
		authorized: true,
		season,
		stats,
		metrics,
		people,
		goals,
		monthlyStats,
		streaks,
		entries,
		awards,
		trivia,
		countriesStats
	};
};
