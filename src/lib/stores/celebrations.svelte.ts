import { browser } from '$app/environment';

export interface AchievementCelebration {
	key: string;
	name: string;
	emoji: string;
	description?: string;
}

export interface CelebrationToast {
	id: string;
	type: 'achievement' | 'milestone';
	title: string;
	message: string;
	emoji: string;
}

const TOAST_DURATION_MS = 5000;
const DEDUPE_TTL_MS = 1000 * 60 * 60 * 12;
const DEDUPE_STORAGE_KEY = 'celebration_dedupe_map';

export let celebrations = $state<CelebrationToast[]>([]);

function readDedupeMap(): Record<string, number> {
	if (!browser) return {};
	try {
		const raw = sessionStorage.getItem(DEDUPE_STORAGE_KEY);
		if (!raw) return {};
		return JSON.parse(raw) as Record<string, number>;
	} catch {
		return {};
	}
}

function writeDedupeMap(map: Record<string, number>) {
	if (!browser) return;
	try {
		sessionStorage.setItem(DEDUPE_STORAGE_KEY, JSON.stringify(map));
	} catch {
		// QuotaExceededError or SecurityError (Safari private mode) — degrade silently
	}
}

function shouldSuppressAndMark(dedupeKey: string): boolean {
	if (!browser) return false;
	const now = Date.now();
	const dedupeMap = readDedupeMap();

	for (const [key, timestamp] of Object.entries(dedupeMap)) {
		if (now - timestamp > DEDUPE_TTL_MS) {
			delete dedupeMap[key];
		}
	}

	if (dedupeMap[dedupeKey] && now - dedupeMap[dedupeKey] < DEDUPE_TTL_MS) {
		writeDedupeMap(dedupeMap);
		return true;
	}

	dedupeMap[dedupeKey] = now;
	writeDedupeMap(dedupeMap);
	return false;
}

export function removeCelebration(id: string) {
	const idx = celebrations.findIndex((t) => t.id === id);
	if (idx !== -1) celebrations.splice(idx, 1);
}

function enqueueToast(toast: Omit<CelebrationToast, 'id'>, dedupeKey: string) {
	if (shouldSuppressAndMark(dedupeKey)) return;

	const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
	celebrations.push({ id, ...toast });

	if (browser) {
		setTimeout(() => removeCelebration(id), TOAST_DURATION_MS);
	}
}

export function pushAchievementCelebrations(personId: number, personName: string, achievements: AchievementCelebration[]) {
	for (const achievement of achievements) {
		enqueueToast(
			{
				type: 'achievement',
				title: 'Achievement unlocked',
				message: `${personName} unlocked ${achievement.name}`,
				emoji: achievement.emoji
			},
			`achievement:${personId}:${achievement.key}`
		);
	}
}

export function pushMilestoneCelebration(personId: number, metricName: string, milestone: number, personName: string) {
	enqueueToast(
		{
			type: 'milestone',
			title: 'Milestone reached',
			message: `${personName} hit ${milestone} ${metricName}`,
			emoji: '🎉'
		},
		`milestone:${personId}:${metricName.toLowerCase()}:${milestone}`
	);
}
