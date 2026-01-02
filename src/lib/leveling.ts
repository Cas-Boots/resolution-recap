// XP and Leveling System
// Gamification system for tracking progress

export interface Level {
	level: number;
	name: string;
	emoji: string;
	minXP: number;
	maxXP: number;
}

export interface XPBreakdown {
	entries: number;
	streaks: number;
	achievements: number;
	goals: number;
	variety: number;
	consistency: number;
	total: number;
}

export interface PlayerStats {
	xp: XPBreakdown;
	level: Level;
	progress: number; // 0-100 percentage to next level
	xpToNextLevel: number;
}

// XP rewards for different actions
export const XP_REWARDS = {
	// Per entry
	entry: 10,
	
	// Streak bonuses (one-time when reached)
	streak3: 25,
	streak7: 75,
	streak14: 150,
	streak30: 400,
	streak60: 1000,
	streak100: 2500,
	
	// Achievement rarity bonuses
	achievementCommon: 50,
	achievementRare: 150,
	achievementEpic: 400,
	achievementLegendary: 1000,
	
	// Goal completion
	goalReached: 200,
	goalExceeded: 100, // Bonus for exceeding
	
	// Variety bonus (using different sports)
	sportVariety: 20, // Per unique sport type used
	
	// Consistency (entries per week average)
	weeklyConsistencyBonus: 15, // Per week with activity
};

// Level definitions
export const LEVELS: Level[] = [
	{ level: 1, name: 'Beginner', emoji: '🌱', minXP: 0, maxXP: 99 },
	{ level: 2, name: 'Starter', emoji: '🌿', minXP: 100, maxXP: 249 },
	{ level: 3, name: 'Rookie', emoji: '🌳', minXP: 250, maxXP: 499 },
	{ level: 4, name: 'Regular', emoji: '⭐', minXP: 500, maxXP: 999 },
	{ level: 5, name: 'Committed', emoji: '🌟', minXP: 1000, maxXP: 1749 },
	{ level: 6, name: 'Dedicated', emoji: '💫', minXP: 1750, maxXP: 2749 },
	{ level: 7, name: 'Achiever', emoji: '🏅', minXP: 2750, maxXP: 3999 },
	{ level: 8, name: 'Champion', emoji: '🏆', minXP: 4000, maxXP: 5499 },
	{ level: 9, name: 'Master', emoji: '👑', minXP: 5500, maxXP: 7499 },
	{ level: 10, name: 'Legend', emoji: '🔥', minXP: 7500, maxXP: 9999 },
	{ level: 11, name: 'Mythic', emoji: '⚡', minXP: 10000, maxXP: 14999 },
	{ level: 12, name: 'Immortal', emoji: '💎', minXP: 15000, maxXP: 24999 },
	{ level: 13, name: 'Transcendent', emoji: '🌈', minXP: 25000, maxXP: 49999 },
	{ level: 14, name: 'Celestial', emoji: '✨', minXP: 50000, maxXP: 99999 },
	{ level: 15, name: 'Godlike', emoji: '🌟', minXP: 100000, maxXP: Infinity },
];

// Get level for a given XP amount
export function getLevelForXP(xp: number): Level {
	for (let i = LEVELS.length - 1; i >= 0; i--) {
		if (xp >= LEVELS[i].minXP) {
			return LEVELS[i];
		}
	}
	return LEVELS[0];
}

// Get progress percentage to next level
export function getLevelProgress(xp: number): number {
	const currentLevel = getLevelForXP(xp);
	if (currentLevel.maxXP === Infinity) return 100;
	
	const xpInLevel = xp - currentLevel.minXP;
	const levelRange = currentLevel.maxXP - currentLevel.minXP + 1;
	return Math.min(100, Math.round((xpInLevel / levelRange) * 100));
}

// Get XP needed for next level
export function getXPToNextLevel(xp: number): number {
	const currentLevel = getLevelForXP(xp);
	if (currentLevel.maxXP === Infinity) return 0;
	return currentLevel.maxXP - xp + 1;
}

// Calculate XP breakdown from stats
export function calculateXP(stats: {
	totalEntries: number;
	longestStreak: number;
	currentStreak: number;
	achievementsUnlocked: { rarity: 'common' | 'rare' | 'epic' | 'legendary' }[];
	goalsCompleted: number;
	goalsExceeded: number;
	uniqueSports: number;
	weeksWithActivity: number;
}): XPBreakdown {
	// Entry XP
	const entriesXP = stats.totalEntries * XP_REWARDS.entry;
	
	// Streak XP (cumulative for streaks reached)
	let streakXP = 0;
	const maxStreak = Math.max(stats.longestStreak, stats.currentStreak);
	if (maxStreak >= 100) streakXP += XP_REWARDS.streak100;
	else if (maxStreak >= 60) streakXP += XP_REWARDS.streak60;
	else if (maxStreak >= 30) streakXP += XP_REWARDS.streak30;
	else if (maxStreak >= 14) streakXP += XP_REWARDS.streak14;
	else if (maxStreak >= 7) streakXP += XP_REWARDS.streak7;
	else if (maxStreak >= 3) streakXP += XP_REWARDS.streak3;
	
	// Achievement XP
	let achievementXP = 0;
	for (const achievement of stats.achievementsUnlocked) {
		switch (achievement.rarity) {
			case 'common': achievementXP += XP_REWARDS.achievementCommon; break;
			case 'rare': achievementXP += XP_REWARDS.achievementRare; break;
			case 'epic': achievementXP += XP_REWARDS.achievementEpic; break;
			case 'legendary': achievementXP += XP_REWARDS.achievementLegendary; break;
		}
	}
	
	// Goal XP
	const goalXP = (stats.goalsCompleted * XP_REWARDS.goalReached) + (stats.goalsExceeded * XP_REWARDS.goalExceeded);
	
	// Variety XP
	const varietyXP = stats.uniqueSports * XP_REWARDS.sportVariety;
	
	// Consistency XP
	const consistencyXP = stats.weeksWithActivity * XP_REWARDS.weeklyConsistencyBonus;
	
	const total = entriesXP + streakXP + achievementXP + goalXP + varietyXP + consistencyXP;
	
	return {
		entries: entriesXP,
		streaks: streakXP,
		achievements: achievementXP,
		goals: goalXP,
		variety: varietyXP,
		consistency: consistencyXP,
		total
	};
}

// Get full player stats
export function getPlayerStats(stats: {
	totalEntries: number;
	longestStreak: number;
	currentStreak: number;
	achievementsUnlocked: { rarity: 'common' | 'rare' | 'epic' | 'legendary' }[];
	goalsCompleted: number;
	goalsExceeded: number;
	uniqueSports: number;
	weeksWithActivity: number;
}): PlayerStats {
	const xp = calculateXP(stats);
	const level = getLevelForXP(xp.total);
	const progress = getLevelProgress(xp.total);
	const xpToNextLevel = getXPToNextLevel(xp.total);
	
	return {
		xp,
		level,
		progress,
		xpToNextLevel
	};
}

// Format XP for display
export function formatXP(xp: number): string {
	if (xp >= 1000) {
		return `${(xp / 1000).toFixed(1)}k`;
	}
	return xp.toString();
}
