import type { PageServerLoad } from './$types';
import { 
	getActiveSeason, 
	getSeasonStats, 
	getEntriesForSeason,
	getActivePeople,
	getActiveMetrics
} from '$lib/server/db';

interface TeaserMessage {
	emoji: string;
	category: 'streak' | 'milestone' | 'movement' | 'mystery' | 'aggregate' | 'challenge';
	message: string;
	copyText: string;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.role !== 'tracker') {
		return { teasers: [], stats: null };
	}

	const season = getActiveSeason();
	if (!season) {
		return { teasers: [], stats: null };
	}

	const stats = getSeasonStats(season.id);
	const entries = getEntriesForSeason(season.id);
	const people = getActivePeople();
	const metrics = getActiveMetrics();

	const teasers: TeaserMessage[] = [];

	// Calculate various stats for teasers
	const today = new Date().toISOString().split('T')[0];
	const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
	const thisWeekStart = new Date();
	thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
	const weekStartStr = thisWeekStart.toISOString().split('T')[0];

	// Group entries by person
	const personEntries = new Map<number, typeof entries>();
	for (const entry of entries) {
		if (!personEntries.has(entry.person_id)) {
			personEntries.set(entry.person_id, []);
		}
		personEntries.get(entry.person_id)!.push(entry);
	}

	// Calculate streaks for each person
	const streaks = new Map<number, number>();
	for (const [personId, pEntries] of personEntries) {
		const dates = [...new Set(pEntries.map(e => e.entry_date))].sort().reverse();
		let streak = 0;
		let checkDate = new Date(today);
		
		for (let i = 0; i < 365; i++) {
			const dateStr = checkDate.toISOString().split('T')[0];
			if (dates.includes(dateStr)) {
				streak++;
				checkDate.setDate(checkDate.getDate() - 1);
			} else if (i === 0) {
				// Allow missing today
				checkDate.setDate(checkDate.getDate() - 1);
			} else {
				break;
			}
		}
		streaks.set(personId, streak);
	}

	// Total entries
	const totalEntries = entries.length;
	const todayEntries = entries.filter(e => e.entry_date === today).length;
	const yesterdayEntries = entries.filter(e => e.entry_date === yesterday).length;
	const weekEntries = entries.filter(e => e.entry_date >= weekStartStr).length;

	// Per-metric totals
	const metricTotals = new Map<string, number>();
	for (const stat of stats) {
		metricTotals.set(stat.metric_name, (metricTotals.get(stat.metric_name) || 0) + stat.count);
	}

	// Rankings per metric
	const rankings = new Map<string, { personId: number; count: number }[]>();
	for (const metric of metrics) {
		const metricStats = stats
			.filter(s => s.metric_name === metric.name)
			.map(s => ({ personId: s.person_id, count: s.count }))
			.sort((a, b) => b.count - a.count);
		rankings.set(metric.name, metricStats);
	}

	// Find interesting facts for teasers
	const maxStreak = Math.max(...streaks.values(), 0);
	const avgEntries = totalEntries / Math.max(people.length, 1);

	// === Generate Teasers ===

	// Aggregate stats (safe to share)
	teasers.push({
		emoji: '📊',
		category: 'aggregate',
		message: `Total group entries: ${totalEntries}`,
		copyText: `📊 *Recap Update*\n\nOnze groep heeft nu al ${totalEntries} entries gelogd! 🎯`
	});

	if (todayEntries > 0) {
		teasers.push({
			emoji: '📅',
			category: 'aggregate',
			message: `${todayEntries} entries logged today`,
			copyText: `📅 *Vandaag*\n\nEr ${todayEntries === 1 ? 'is' : 'zijn'} vandaag al ${todayEntries} ${todayEntries === 1 ? 'entry' : 'entries'} toegevoegd! Wie zou dat zijn? 🤔`
		});
	}

	if (weekEntries > 0) {
		teasers.push({
			emoji: '📈',
			category: 'aggregate',
			message: `${weekEntries} entries this week`,
			copyText: `📈 *Deze week*\n\n${weekEntries} entries deze week! Blijven gaan team! 💪`
		});
	}

	// Streak teasers (anonymous)
	if (maxStreak >= 3) {
		teasers.push({
			emoji: '🔥',
			category: 'streak',
			message: `Someone has a ${maxStreak}-day streak!`,
			copyText: `🔥 *Streak Alert*\n\nIemand heeft een streak van ${maxStreak} dagen op rij! Wie zou het zijn? 🤫`
		});
	}

	if (maxStreak >= 7) {
		teasers.push({
			emoji: '⚡',
			category: 'streak',
			message: `A week-long streak is active!`,
			copyText: `⚡ *Impressive!*\n\nEen van ons heeft al een hele week lang elke dag gelogd! Dedication! 💪`
		});
	}

	// Milestone teasers
	for (const [metricName, total] of metricTotals) {
		const milestones = [10, 25, 50, 75, 100, 150, 200, 250, 500];
		for (const milestone of milestones) {
			if (total >= milestone && total < milestone + 5) {
				teasers.push({
					emoji: '🎯',
					category: 'milestone',
					message: `Group hit ${milestone}+ ${metricName}!`,
					copyText: `🎯 *Milestone!*\n\nAls groep hebben we de ${milestone} ${metricName} gepasseerd! 🎉`
				});
			}
		}

		// Individual milestones (anonymous)
		const ranking = rankings.get(metricName) || [];
		for (const { count } of ranking) {
			for (const milestone of [10, 25, 50, 100]) {
				if (count >= milestone && count < milestone + 3) {
					teasers.push({
						emoji: '🏆',
						category: 'milestone',
						message: `Someone reached ${milestone} ${metricName}!`,
						copyText: `🏆 *Personal Milestone*\n\nIemand heeft de ${milestone} ${metricName} bereikt! Wie zou deze ijverige speler zijn? 👀`
					});
					break;
				}
			}
		}
	}

	// Movement/Competition teasers
	for (const [metricName, ranking] of rankings) {
		if (ranking.length >= 2) {
			const gap = ranking[0].count - ranking[1].count;
			if (gap <= 3 && gap >= 0) {
				teasers.push({
					emoji: '🏁',
					category: 'movement',
					message: `Tight race for #1 in ${metricName}!`,
					copyText: `🏁 *Spannend!*\n\nHet verschil tussen #1 en #2 voor ${metricName} is maar ${gap}! Wie pakt de leiding? 😱`
				});
			}

			if (ranking.length >= 3) {
				const topGap = ranking[0].count - ranking[2].count;
				if (topGap <= 5) {
					teasers.push({
						emoji: '📊',
						category: 'movement',
						message: `Top 3 is very close in ${metricName}!`,
						copyText: `📊 *Neck and neck*\n\nDe top 3 voor ${metricName} zit super dicht bij elkaar! Alles kan nog gebeuren... 🎲`
					});
				}
			}
		}
	}

	// Mystery/Cryptic teasers
	const crypticMessages = [
		{ emoji: '🌅', message: 'An early bird caught the worm today...', copy: '🌅 *Cryptisch...*\n\nEen vroege vogel heeft vanochtend al gelogd... Wie is onze early bird? 🐦' },
		{ emoji: '🦉', message: 'A night owl was active last night...', copy: '🦉 *Laat bezig...*\n\nEen nachtuil was gisteravond nog actief... 🌙' },
		{ emoji: '📈', message: 'Someone is on a roll...', copy: '📈 *On a roll*\n\nIemand is lekker bezig de laatste tijd... Keep it up! 💫' },
		{ emoji: '🎯', message: 'A comeback story is brewing...', copy: '🎯 *Comeback?*\n\nIemand die eerst wat achterliep is aan een comeback bezig... 👀' },
		{ emoji: '⭐', message: 'Consistency is being rewarded...', copy: '⭐ *Consistent*\n\nSommigen blijven gewoon elke week leveren. Respect! 🙌' },
	];

	// Add 2-3 random cryptic messages
	const shuffled = crypticMessages.sort(() => Math.random() - 0.5);
	for (let i = 0; i < Math.min(2, shuffled.length); i++) {
		teasers.push({
			emoji: shuffled[i].emoji,
			category: 'mystery',
			message: shuffled[i].message,
			copyText: shuffled[i].copy
		});
	}

	// Challenge teasers
	const challenges = [
		{ emoji: '💪', message: 'Weekend challenge: Can we beat last week?', copy: '💪 *Weekend Challenge*\n\nKunnen we dit weekend meer loggen dan vorige week? Let\'s go! 🚀' },
		{ emoji: '🎯', message: 'Who will log next?', copy: '🎯 *Wie is de volgende?*\n\nWie logt als volgende? Niet te lang wachten! ⏰' },
		{ emoji: '🔥', message: 'Can anyone start a streak today?', copy: '🔥 *Streak starten?*\n\nVandaag is een perfecte dag om een streak te beginnen! Wie doet mee? 🙋' },
		{ emoji: '📊', message: 'Midweek motivation needed!', copy: '📊 *Midweek Motivatie*\n\nWe zijn halverwege de week! Niet vergeten te loggen! 💪' },
	];

	// Add 1-2 random challenges
	const shuffledChallenges = challenges.sort(() => Math.random() - 0.5);
	teasers.push({
		...shuffledChallenges[0],
		category: 'challenge'
	});

	// Summary stats for the page
	const summaryStats = {
		totalEntries,
		todayEntries,
		weekEntries,
		maxStreak,
		avgEntries: Math.round(avgEntries * 10) / 10,
		peopleCount: people.length,
		metricTotals: Object.fromEntries(metricTotals)
	};

	return { 
		teasers: teasers.slice(0, 15), // Limit to 15 teasers
		stats: summaryStats 
	};
};
