import type { Translations } from './i18n';

export interface SportEntry {
	value: string;
	emoji: string;
	group: string;
	translationKey: keyof Translations['sports'];
	englishLabel: string;
}

export const SPORTS: readonly SportEntry[] = [
	// Cardio
	{ value: 'running',       emoji: '🏃',  group: 'Cardio',        translationKey: 'running',      englishLabel: 'Running' },
	{ value: 'cycling',       emoji: '🚴',  group: 'Cardio',        translationKey: 'cycling',      englishLabel: 'Cycling' },
	{ value: 'hiking',        emoji: '🥾',  group: 'Cardio',        translationKey: 'hiking',       englishLabel: 'Hiking' },
	// Water
	{ value: 'swimming',      emoji: '🏊',  group: 'Water',         translationKey: 'swimming',     englishLabel: 'Swimming' },
	{ value: 'kayaking',      emoji: '🛶',  group: 'Water',         translationKey: 'kayaking',     englishLabel: 'Kayaking' },
	{ value: 'rafting',       emoji: '🚣',  group: 'Water',         translationKey: 'rafting',      englishLabel: 'Rafting' },
	{ value: 'rowing',        emoji: '🚣',  group: 'Water',         translationKey: 'rowing',       englishLabel: 'Rowing' },
	{ value: 'paddleboarding', emoji: '🏄', group: 'Water',         translationKey: 'paddleboarding', englishLabel: 'Paddleboarding' },
	// Gym & Fitness
	{ value: 'gym',           emoji: '🏋️', group: 'Gym & Fitness', translationKey: 'gym',          englishLabel: 'Gym' },
	{ value: 'hyrox',         emoji: '🏆',  group: 'Gym & Fitness', translationKey: 'hyrox',        englishLabel: 'Hyrox' },
	{ value: 'bootcamp',      emoji: '💪',  group: 'Gym & Fitness', translationKey: 'bootcamp',     englishLabel: 'Bootcamp' },
	{ value: 'physio',        emoji: '🧑‍⚕️', group: 'Gym & Fitness', translationKey: 'physio',       englishLabel: 'Physio' },
	// Mind & Body
	{ value: 'yoga',          emoji: '🧘',  group: 'Mind & Body',   translationKey: 'yoga',         englishLabel: 'Yoga' },
	{ value: 'pilates',       emoji: '🧘',  group: 'Mind & Body',   translationKey: 'pilates',      englishLabel: 'Pilates' },
	// Racket
	{ value: 'tennis',        emoji: '🎾',  group: 'Racket',        translationKey: 'tennis',       englishLabel: 'Tennis' },
	{ value: 'padel',         emoji: '🎾',  group: 'Racket',        translationKey: 'padel',        englishLabel: 'Padel' },
	{ value: 'badminton',     emoji: '🏸',  group: 'Racket',        translationKey: 'badminton',    englishLabel: 'Badminton' },
	{ value: 'squash',        emoji: '🎾',  group: 'Racket',        translationKey: 'squash',       englishLabel: 'Squash' },
	{ value: 'table-tennis',  emoji: '🏓',  group: 'Racket',        translationKey: 'tableTennis',  englishLabel: 'Table Tennis' },
	// Team
	{ value: 'football',      emoji: '⚽',  group: 'Team',          translationKey: 'football',     englishLabel: 'Football' },
	{ value: 'basketball',    emoji: '🏀',  group: 'Team',          translationKey: 'basketball',   englishLabel: 'Basketball' },
	{ value: 'hockey',        emoji: '🏑',  group: 'Team',          translationKey: 'hockey',       englishLabel: 'Hockey' },
	{ value: 'volleyball',    emoji: '🏐',  group: 'Team',          translationKey: 'volleyball',   englishLabel: 'Volleyball' },
	{ value: 'korfball',      emoji: '🏐',  group: 'Team',          translationKey: 'korfball',     englishLabel: 'Korfball' },
	// Climbing
	{ value: 'climbing',      emoji: '🧗',  group: 'Climbing',      translationKey: 'climbing',     englishLabel: 'Climbing' },
	{ value: 'bouldering',    emoji: '🧗',  group: 'Climbing',      translationKey: 'bouldering',   englishLabel: 'Bouldering' },
	// Winter
	{ value: 'skiing',        emoji: '⛷️', group: 'Winter',        translationKey: 'skiing',       englishLabel: 'Skiing' },
	{ value: 'snowboarding',  emoji: '🏂',  group: 'Winter',        translationKey: 'snowboarding', englishLabel: 'Snowboarding' },
	{ value: 'ice-skating',   emoji: '⛸️', group: 'Winter',        translationKey: 'iceSkating',   englishLabel: 'Ice Skating' },
	{ value: 'road-skating',  emoji: '🛼',  group: 'Winter',        translationKey: 'roadSkating',  englishLabel: 'Road Skating' },
	{ value: 'sledding',      emoji: '🛷',  group: 'Winter',        translationKey: 'sledding',     englishLabel: 'Sledding' },
	// Combat
	{ value: 'boxing',        emoji: '🥊',  group: 'Combat',        translationKey: 'boxing',       englishLabel: 'Boxing' },
	{ value: 'martial-arts',  emoji: '🥋',  group: 'Combat',        translationKey: 'martialArts',  englishLabel: 'Martial Arts' },
	// Other
	{ value: 'dance',         emoji: '💃',  group: 'Other',         translationKey: 'dance',        englishLabel: 'Dance' },
	{ value: 'other',         emoji: '🏅',  group: 'Other',         translationKey: 'other',        englishLabel: 'Other' },
];

// Legacy aliases: old tag values → canonical SPORTS value
export const SPORT_ALIASES: Record<string, string> = {
	'skating':        'ice-skating',
	'inline-skating': 'road-skating',
	'skeeleren':      'road-skating',
	'soccer':         'football',
};

// Tags that appear in historical data but are not selectable in forms
export const LEGACY_SPORT_DISPLAY: Record<string, { emoji: string; englishLabel: string }> = {
	'walking': { emoji: '🚶', englishLabel: 'Walking' },
	'fitness': { emoji: '💪', englishLabel: 'Fitness' },
};

export function canonicalSportTag(raw: string): string {
	const cleaned = raw.trim().toLowerCase();
	return SPORT_ALIASES[cleaned] ?? cleaned;
}

export function findSport(value: string): SportEntry | undefined {
	return SPORTS.find(s => s.value === value);
}

export function groupedSports(): { label: string; sports: SportEntry[] }[] {
	const seen = new Map<string, SportEntry[]>();
	for (const sport of SPORTS) {
		if (!seen.has(sport.group)) seen.set(sport.group, []);
		seen.get(sport.group)!.push(sport);
	}
	return Array.from(seen.entries()).map(([label, sports]) => ({ label, sports }));
}
