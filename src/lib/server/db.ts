import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Check if we're in build phase - don't initialize DB during build
// Only check npm_lifecycle_event which is set during npm run build
const isBuildPhase = process.env.npm_lifecycle_event === 'build';

// Lazy database initialization - only create when first accessed at runtime
let _db: DatabaseType | null = null;
let _initError: Error | null = null;

function getDb(): DatabaseType {
	if (_initError) throw _initError;
	if (_db) return _db;
	
	if (isBuildPhase) {
		_initError = new Error('Database should not be accessed during build phase');
		throw _initError;
	}

	try {
		const dbPath = process.env.DB_PATH || './data/resolution-recap.db';
		console.log('🗄️  Initializing database at:', dbPath);
		
		const dbDir = path.dirname(dbPath);
		if (!fs.existsSync(dbDir)) {
			console.log('📁 Creating data directory:', dbDir);
			fs.mkdirSync(dbDir, { recursive: true });
		}

		_db = new Database(dbPath);

		// Enable WAL mode for better concurrent access
		_db.pragma('journal_mode = WAL');

		// Initialize schema
		initializeSchema(_db);
		
		// Seed data if needed
		seedDatabase(_db, dbPath);
		
		console.log('✅ Database initialized successfully');

		return _db;
	} catch (error) {
		console.error('❌ Database initialization failed:', error);
		_initError = error as Error;
		throw error;
	}
}

// Export a proxy that lazily initializes the database
export const db = new Proxy({} as DatabaseType, {
	get(_, prop) {
		const database = getDb();
		const value = (database as any)[prop];
		if (typeof value === 'function') {
			return value.bind(database);
		}
		return value;
	}
});

function initializeSchema(database: DatabaseType) {
	database.exec(`
	CREATE TABLE IF NOT EXISTS seasons (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		year INTEGER NOT NULL UNIQUE,
		name TEXT NOT NULL,
		is_active INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS people (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		emoji TEXT NOT NULL DEFAULT '👤',
		is_active INTEGER NOT NULL DEFAULT 1,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS metrics (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		is_active INTEGER NOT NULL DEFAULT 1,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS entries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		season_id INTEGER NOT NULL,
		person_id INTEGER NOT NULL,
		metric_id INTEGER NOT NULL,
		entry_date TEXT NOT NULL,
		notes TEXT,
		deleted_at TEXT DEFAULT NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (season_id) REFERENCES seasons(id),
		FOREIGN KEY (person_id) REFERENCES people(id),
		FOREIGN KEY (metric_id) REFERENCES metrics(id)
	);

	-- Audit log table: append-only, never delete from this
	CREATE TABLE IF NOT EXISTS entry_audit (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		entry_id INTEGER NOT NULL,
		action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'undelete')),
		old_values TEXT,
		new_values TEXT,
		performed_by TEXT NOT NULL CHECK (performed_by IN ('tracker', 'admin')),
		performed_at TEXT NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (entry_id) REFERENCES entries(id)
	);

	-- Settings table for configurable values like PINs
	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE INDEX IF NOT EXISTS idx_entries_season ON entries(season_id);
	CREATE INDEX IF NOT EXISTS idx_entries_person ON entries(person_id);
	CREATE INDEX IF NOT EXISTS idx_entries_metric ON entries(metric_id);
	CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(entry_date);
	CREATE INDEX IF NOT EXISTS idx_entry_audit_entry ON entry_audit(entry_id);
`);

	// Migration: Add deleted_at column if it doesn't exist (for existing databases)
	try {
		database.exec(`ALTER TABLE entries ADD COLUMN deleted_at TEXT DEFAULT NULL`);
	} catch {
		// Column already exists
	}

	// Migration: Add tags column for sporting activity types
	try {
		database.exec(`ALTER TABLE entries ADD COLUMN tags TEXT DEFAULT NULL`);
	} catch {
		// Column already exists
	}

	// Create index for deleted_at (after migration ensures column exists)
	try {
		database.exec(`CREATE INDEX IF NOT EXISTS idx_entries_deleted ON entries(deleted_at)`);
	} catch {
		// Index might already exist
	}

	// Migration: Create entry_audit table if it doesn't exist
	try {
		database.exec(`
			CREATE TABLE IF NOT EXISTS entry_audit (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				entry_id INTEGER NOT NULL,
				action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'undelete')),
				old_values TEXT,
				new_values TEXT,
				performed_by TEXT NOT NULL CHECK (performed_by IN ('tracker', 'admin')),
				performed_at TEXT NOT NULL DEFAULT (datetime('now')),
				FOREIGN KEY (entry_id) REFERENCES entries(id)
			);
			CREATE INDEX IF NOT EXISTS idx_entry_audit_entry ON entry_audit(entry_id);
		`);
	} catch {
		// Table already exists
	}

	// Migration: Create settings table if it doesn't exist
	try {
		database.exec(`
			CREATE TABLE IF NOT EXISTS settings (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`);
	} catch {
		// Table already exists
	}

	// Migration: Add emoji column to people table if it doesn't exist
	try {
		database.exec(`ALTER TABLE people ADD COLUMN emoji TEXT NOT NULL DEFAULT '👤'`);
		// Set unique emojis for existing people
		const defaultEmojis: Record<string, string> = {
			'Cas': '🎯', 'Joris': '🦁', 'Eva': '🌸', 'Rik': '🎸', 'Liz': '✨', 'Bastiaan': '🚀'
		};
		const updateEmoji = database.prepare('UPDATE people SET emoji = ? WHERE name = ?');
		for (const [name, emoji] of Object.entries(defaultEmojis)) {
			updateEmoji.run(emoji, name);
		}
	} catch {
		// Column already exists
	}

	// Migration: Add emoji column to metrics table if it doesn't exist
	try {
		database.exec(`ALTER TABLE metrics ADD COLUMN emoji TEXT NOT NULL DEFAULT '📊'`);
		// Set unique emojis for existing metrics
		const defaultMetricEmojis: Record<string, string> = {
			'sporting': '🏃', 'cakes eaten': '🎂'
		};
		const updateMetricEmoji = database.prepare('UPDATE metrics SET emoji = ? WHERE LOWER(name) = LOWER(?)');
		for (const [name, emoji] of Object.entries(defaultMetricEmojis)) {
			updateMetricEmoji.run(emoji, name);
		}
	} catch {
		// Column already exists
	}

	// Migration: Create goals table for tracking targets per person per metric per season
	try {
		database.exec(`
			CREATE TABLE IF NOT EXISTS goals (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				season_id INTEGER NOT NULL,
				person_id INTEGER NOT NULL,
				metric_id INTEGER NOT NULL,
				target INTEGER NOT NULL,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now')),
				FOREIGN KEY (season_id) REFERENCES seasons(id),
				FOREIGN KEY (person_id) REFERENCES people(id),
				FOREIGN KEY (metric_id) REFERENCES metrics(id),
				UNIQUE(season_id, person_id, metric_id)
			);
			CREATE INDEX IF NOT EXISTS idx_goals_season ON goals(season_id);
		`);
	} catch {
		// Table already exists
	}

	// Migration: Create achievements table
	try {
		database.exec(`
			CREATE TABLE IF NOT EXISTS achievements (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				season_id INTEGER NOT NULL,
				person_id INTEGER NOT NULL,
				achievement_key TEXT NOT NULL,
				unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
				FOREIGN KEY (season_id) REFERENCES seasons(id),
				FOREIGN KEY (person_id) REFERENCES people(id),
				UNIQUE(season_id, person_id, achievement_key)
			);
			CREATE INDEX IF NOT EXISTS idx_achievements_person ON achievements(person_id);
		`);
	} catch {
		// Table already exists
	}

	// Migration: Create countries_visited table for tracking countries per person per season
	try {
		database.exec(`
			CREATE TABLE IF NOT EXISTS countries_visited (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				season_id INTEGER NOT NULL,
				person_id INTEGER NOT NULL,
				country_code TEXT NOT NULL,
				country_name TEXT NOT NULL,
				visited_at TEXT NOT NULL DEFAULT (datetime('now')),
				FOREIGN KEY (season_id) REFERENCES seasons(id),
				FOREIGN KEY (person_id) REFERENCES people(id),
				UNIQUE(season_id, person_id, country_code)
			);
			CREATE INDEX IF NOT EXISTS idx_countries_visited_person ON countries_visited(person_id);
			CREATE INDEX IF NOT EXISTS idx_countries_visited_season ON countries_visited(season_id);
		`);
	} catch {
		// Table already exists
	}
}

// Achievement definitions
export interface AchievementDef {
	key: string;
	name: string;
	emoji: string;
	description: string;
	rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export const ACHIEVEMENTS: AchievementDef[] = [
	// Entry milestones
	{ key: 'first_entry', name: 'First Steps', emoji: '👣', description: 'Log your first entry', rarity: 'common' },
	{ key: 'entries_10', name: 'Getting Started', emoji: '🌱', description: 'Log 10 entries', rarity: 'common' },
	{ key: 'entries_25', name: 'Quarter Century', emoji: '🎯', description: 'Log 25 entries', rarity: 'common' },
	{ key: 'entries_50', name: 'Half Century', emoji: '⭐', description: 'Log 50 entries', rarity: 'rare' },
	{ key: 'entries_100', name: 'Century Club', emoji: '💯', description: 'Log 100 entries', rarity: 'epic' },
	{ key: 'entries_200', name: 'Double Century', emoji: '🏆', description: 'Log 200 entries', rarity: 'legendary' },
	
	// Streak achievements
	{ key: 'streak_3d', name: 'Hat Trick', emoji: '🎩', description: '3-day streak', rarity: 'common' },
	{ key: 'streak_7d', name: 'Week Warrior', emoji: '⚔️', description: '7-day streak', rarity: 'rare' },
	{ key: 'streak_14d', name: 'Fortnight Fighter', emoji: '🛡️', description: '14-day streak', rarity: 'epic' },
	{ key: 'streak_30d', name: 'Month Master', emoji: '👑', description: '30-day streak', rarity: 'legendary' },
	
	// Weekly streaks
	{ key: 'weekly_4', name: 'Monthly Regular', emoji: '📅', description: '4 consecutive weeks', rarity: 'common' },
	{ key: 'weekly_8', name: 'Two Month Streak', emoji: '🔥', description: '8 consecutive weeks', rarity: 'rare' },
	{ key: 'weekly_12', name: 'Quarter Champion', emoji: '🏅', description: '12 consecutive weeks', rarity: 'epic' },
	
	// Special achievements
	{ key: 'early_bird', name: 'Early Bird', emoji: '🐦', description: 'Log entries in January', rarity: 'common' },
	{ key: 'consistency_king', name: 'Consistency King', emoji: '🤴', description: 'Log entries every month', rarity: 'legendary' },
	{ key: 'weekend_warrior', name: 'Weekend Warrior', emoji: '🦸', description: 'Most entries on weekends', rarity: 'rare' },
	{ key: 'goal_crusher', name: 'Goal Crusher', emoji: '💪', description: 'Exceed a goal by 50%', rarity: 'epic' },
	{ key: 'perfectionist', name: 'Perfectionist', emoji: '✨', description: 'Hit a goal exactly', rarity: 'rare' },
	{ key: 'all_rounder', name: 'All Rounder', emoji: '🎭', description: 'Log entries for all metrics', rarity: 'common' }
];

// Settings helper functions (defined early so seedDatabase can use them)
export function getSetting(key: string): string | null {
	const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
	return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
	db.prepare(`
		INSERT INTO settings (key, value, updated_at) 
		VALUES (?, ?, datetime('now'))
		ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
	`).run(key, value);
}

// Seed data if tables are empty
function seedDatabase(database: DatabaseType, dbPath: string) {
	const seasonCount = database.prepare('SELECT COUNT(*) as count FROM seasons').get() as { count: number };
	const entriesCount = database.prepare('SELECT COUNT(*) as count FROM entries').get() as { count: number };
	
	// Warn if database appears to be freshly created in production
	const isProduction = process.env.NODE_ENV === 'production';
	if (isProduction && seasonCount.count === 0 && entriesCount.count === 0) {
		console.warn('⚠️  WARNING: Database is empty in production!');
		console.warn('📦 Seeding database with initial data...');
		console.warn('⚠️  This might indicate that the volume was not mounted correctly.');
		console.warn('⚠️  Check that /app/data is mounted to a persistent volume.');
		console.warn('⚠️  DB_PATH:', dbPath);
	}
	
	if (seasonCount.count === 0) {
		console.log('📦 Seeding database with initial data...');
		// Insert 2026 season as active
		database.prepare(`
			INSERT INTO seasons (year, name, is_active) VALUES (2026, 'Season 2026', 1)
		`).run();
	}

	const peopleCount = database.prepare('SELECT COUNT(*) as count FROM people').get() as { count: number };
	
	if (peopleCount.count === 0) {
		const insertPerson = database.prepare('INSERT INTO people (name, emoji) VALUES (?, ?)');
		const friends: [string, string][] = [
			['Cas', '🎯'],
			['Joris', '🦁'],
			['Eva', '🌸'],
			['Rik', '🎸'],
			['Liz', '✨'],
			['Bastiaan', '🚀']
		];
		for (const [name, emoji] of friends) {
			insertPerson.run(name, emoji);
		}
	}

	const metricsCount = database.prepare('SELECT COUNT(*) as count FROM metrics').get() as { count: number };
	
	if (metricsCount.count === 0) {
		const insertMetric = database.prepare('INSERT INTO metrics (name) VALUES (?)');
		const metrics = ['Sporting', 'Cakes Eaten'];
		for (const name of metrics) {
			insertMetric.run(name);
		}
	}

	// Initialize PINs from environment if not set in database
	const trackerPin = database.prepare('SELECT value FROM settings WHERE key = ?').get('tracker_pin') as { value: string } | undefined;
	if (!trackerPin && process.env.TRACKER_PIN) {
		database.prepare(`
			INSERT INTO settings (key, value, updated_at) 
			VALUES (?, ?, datetime('now'))
			ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
		`).run('tracker_pin', process.env.TRACKER_PIN);
	}
	const adminPin = database.prepare('SELECT value FROM settings WHERE key = ?').get('admin_pin') as { value: string } | undefined;
	if (!adminPin && process.env.ADMIN_PIN) {
		database.prepare(`
			INSERT INTO settings (key, value, updated_at) 
			VALUES (?, ?, datetime('now'))
			ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
		`).run('admin_pin', process.env.ADMIN_PIN);
	}
}

// Type definitions
export interface Season {
	id: number;
	year: number;
	name: string;
	is_active: number;
	created_at: string;
}

export interface Person {
	id: number;
	name: string;
	emoji: string;
	is_active: number;
	created_at: string;
}

export interface Metric {
	id: number;
	name: string;
	emoji: string;
	is_active: number;
	created_at: string;
}

export interface Entry {
	id: number;
	season_id: number;
	person_id: number;
	metric_id: number;
	entry_date: string;
	notes: string | null;
	tags: string | null;
	deleted_at: string | null;
	created_at: string;
}

export interface EntryWithNames extends Entry {
	person_name: string;
	person_emoji: string;
	metric_name: string;
}

export interface EntryAudit {
	id: number;
	entry_id: number;
	action: 'create' | 'update' | 'delete' | 'undelete';
	old_values: string | null;
	new_values: string | null;
	performed_by: 'tracker' | 'admin';
	performed_at: string;
}

export interface Goal {
	id: number;
	season_id: number;
	person_id: number;
	metric_id: number;
	target: number;
	created_at: string;
	updated_at: string;
}

export interface GoalWithNames extends Goal {
	person_name: string;
	person_emoji: string;
	metric_name: string;
	metric_emoji: string;
}

export interface CountryVisit {
	id: number;
	season_id: number;
	person_id: number;
	country_code: string;
	country_name: string;
	visited_at: string;
}

export interface CountryVisitWithPerson extends CountryVisit {
	person_name: string;
	person_emoji: string;
}

// Query helpers
export function getActiveSeason(): Season | undefined {
	return db.prepare('SELECT * FROM seasons WHERE is_active = 1').get() as Season | undefined;
}

export function getAllSeasons(): Season[] {
	return db.prepare('SELECT * FROM seasons ORDER BY year DESC').all() as Season[];
}

export function setActiveSeason(seasonId: number): void {
	db.prepare('UPDATE seasons SET is_active = 0').run();
	db.prepare('UPDATE seasons SET is_active = 1 WHERE id = ?').run(seasonId);
}

export function createSeason(year: number, name: string): Season {
	const result = db.prepare('INSERT INTO seasons (year, name) VALUES (?, ?)').run(year, name);
	return db.prepare('SELECT * FROM seasons WHERE id = ?').get(result.lastInsertRowid) as Season;
}

export function getActivePeople(): Person[] {
	return db.prepare('SELECT * FROM people WHERE is_active = 1 ORDER BY name').all() as Person[];
}

export function getAllPeople(): Person[] {
	return db.prepare('SELECT * FROM people ORDER BY name').all() as Person[];
}

// Pool of unique emojis for auto-assignment
const EMOJI_POOL = [
	'🎯', '🦁', '🌸', '🎸', '✨', '🚀', '🌟', '🎨', '🦋', '🌈',
	'🔥', '💎', '🎭', '🎪', '🎬', '🎤', '🎵', '🏆', '⚡', '🌺',
	'🦊', '🐼', '🦄', '🐉', '🦅', '🐬', '🦎', '🦜', '🐙', '🦩',
	'🍀', '🌻', '🌴', '🍄', '🌵', '🍁', '🌊', '❄️', '🌙', '☀️',
	'🎲', '🎰', '🎳', '🎱', '🏀', '⚽', '🎾', '🏐', '🎿', '🏄'
];

function getNextUniqueEmoji(): string {
	const usedEmojis = db.prepare('SELECT emoji FROM people').all() as { emoji: string }[];
	const usedSet = new Set(usedEmojis.map(p => p.emoji));
	
	for (const emoji of EMOJI_POOL) {
		if (!usedSet.has(emoji)) {
			return emoji;
		}
	}
	// If all pool emojis are used, return a random one from extended set
	const fallback = ['🔮', '💫', '🌠', '🎆', '🎇', '🧨', '🎁', '🎀', '🪄', '🧸'];
	return fallback[Math.floor(Math.random() * fallback.length)];
}

export function createPerson(name: string, emoji?: string): Person {
	// Auto-assign unique emoji if not provided or if default
	const finalEmoji = (!emoji || emoji === '👤') ? getNextUniqueEmoji() : emoji;
	const result = db.prepare('INSERT INTO people (name, emoji) VALUES (?, ?)').run(name, finalEmoji);
	return db.prepare('SELECT * FROM people WHERE id = ?').get(result.lastInsertRowid) as Person;
}

export function updatePerson(id: number, name: string, isActive: boolean, emoji?: string): void {
	if (emoji !== undefined) {
		db.prepare('UPDATE people SET name = ?, is_active = ?, emoji = ? WHERE id = ?').run(name, isActive ? 1 : 0, emoji, id);
	} else {
		db.prepare('UPDATE people SET name = ?, is_active = ? WHERE id = ?').run(name, isActive ? 1 : 0, id);
	}
}

export function getActiveMetrics(): Metric[] {
	return db.prepare('SELECT * FROM metrics WHERE is_active = 1 ORDER BY name').all() as Metric[];
}

export function getAllMetrics(): Metric[] {
	return db.prepare('SELECT * FROM metrics ORDER BY name').all() as Metric[];
}

// Pool of unique emojis for metrics/activities auto-assignment
const METRIC_EMOJI_POOL = [
	'🏃', '🎂', '📚', '💪', '🎮', '🍕', '🎬', '🎵', '✈️', '🛒',
	'🏋️', '🧘', '🚴', '⛷️', '🏊', '🎯', '🎳', '🎲', '🃏', '♟️',
	'📝', '💻', '📱', '🎨', '📷', '🎤', '🎹', '🥁', '🎻', '🎸',
	'🍳', '🍰', '🍺', '☕', '🍷', '🥗', '🍔', '🌮', '🍣', '🍜',
	'🚗', '🚲', '🏠', '🌳', '🌊', '⛰️', '🏕️', '🎡', '🎢', '🎪'
];

function getNextUniqueMetricEmoji(): string {
	const usedEmojis = db.prepare('SELECT emoji FROM metrics').all() as { emoji: string }[];
	const usedSet = new Set(usedEmojis.map(m => m.emoji));
	
	for (const emoji of METRIC_EMOJI_POOL) {
		if (!usedSet.has(emoji)) {
			return emoji;
		}
	}
	// If all pool emojis are used, return a random one from extended set
	const fallback = ['📈', '📉', '📊', '🔔', '⭐', '💡', '🔧', '🎁', '🏅', '🎖️'];
	return fallback[Math.floor(Math.random() * fallback.length)];
}

export function createMetric(name: string, emoji?: string): Metric {
	// Auto-assign unique emoji if not provided or if default
	const finalEmoji = (!emoji || emoji === '📊') ? getNextUniqueMetricEmoji() : emoji;
	const result = db.prepare('INSERT INTO metrics (name, emoji) VALUES (?, ?)').run(name, finalEmoji);
	return db.prepare('SELECT * FROM metrics WHERE id = ?').get(result.lastInsertRowid) as Metric;
}

export function updateMetric(id: number, name: string, isActive: boolean, emoji?: string): void {
	if (emoji !== undefined) {
		db.prepare('UPDATE metrics SET name = ?, is_active = ?, emoji = ? WHERE id = ?').run(name, isActive ? 1 : 0, emoji, id);
	} else {
		db.prepare('UPDATE metrics SET name = ?, is_active = ? WHERE id = ?').run(name, isActive ? 1 : 0, id);
	}
}

export function getEntriesForSeason(seasonId: number, includeDeleted = false): EntryWithNames[] {
	const deletedFilter = includeDeleted ? '' : 'AND e.deleted_at IS NULL';
	return db.prepare(`
		SELECT e.*, p.name as person_name, p.emoji as person_emoji, m.name as metric_name
		FROM entries e
		JOIN people p ON e.person_id = p.id
		JOIN metrics m ON e.metric_id = m.id
		WHERE e.season_id = ? ${deletedFilter}
		ORDER BY e.entry_date DESC, e.created_at DESC
	`).all(seasonId) as EntryWithNames[];
}

export function getRecentEntries(seasonId: number, limit = 10): EntryWithNames[] {
	return db.prepare(`
		SELECT e.*, p.name as person_name, p.emoji as person_emoji, m.name as metric_name
		FROM entries e
		JOIN people p ON e.person_id = p.id
		JOIN metrics m ON e.metric_id = m.id
		WHERE e.season_id = ? AND e.deleted_at IS NULL
		ORDER BY e.created_at DESC
		LIMIT ?
	`).all(seasonId, limit) as EntryWithNames[];
}

export function getEntriesForSeasonInRange(seasonId: number, startDate: string, endDate: string): EntryWithNames[] {
	return db.prepare(`
		SELECT e.*, p.name as person_name, p.emoji as person_emoji, m.name as metric_name
		FROM entries e
		JOIN people p ON e.person_id = p.id
		JOIN metrics m ON e.metric_id = m.id
		WHERE e.season_id = ? AND e.entry_date >= ? AND e.entry_date <= ? AND e.deleted_at IS NULL
		ORDER BY e.entry_date DESC, e.created_at DESC
	`).all(seasonId, startDate, endDate) as EntryWithNames[];
}

// Get daily counts for sparkline charts (last N days per person per metric)
export function getDailyCountsForSparkline(seasonId: number, days = 7): { person_id: number; metric_id: number; entry_date: string; count: number }[] {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days + 1);
	const startDateStr = startDate.toISOString().split('T')[0];
	
	return db.prepare(`
		SELECT 
			e.person_id,
			e.metric_id,
			e.entry_date,
			COUNT(*) as count
		FROM entries e
		WHERE e.season_id = ? AND e.entry_date >= ? AND e.deleted_at IS NULL
		GROUP BY e.person_id, e.metric_id, e.entry_date
		ORDER BY e.entry_date ASC
	`).all(seasonId, startDateStr) as { person_id: number; metric_id: number; entry_date: string; count: number }[];
}

// Get today's entries for the activity summary
export function getTodayEntries(seasonId: number): EntryWithNames[] {
	const today = new Date().toISOString().split('T')[0];
	return db.prepare(`
		SELECT e.*, p.name as person_name, p.emoji as person_emoji, m.name as metric_name
		FROM entries e
		JOIN people p ON e.person_id = p.id
		JOIN metrics m ON e.metric_id = m.id
		WHERE e.season_id = ? AND e.entry_date = ? AND e.deleted_at IS NULL
		ORDER BY e.created_at DESC
	`).all(seasonId, today) as EntryWithNames[];
}

// Get entries for a specific person (for expandable details)
export function getEntriesForPerson(seasonId: number, personId: number, limit = 20): EntryWithNames[] {
	return db.prepare(`
		SELECT e.*, p.name as person_name, p.emoji as person_emoji, m.name as metric_name
		FROM entries e
		JOIN people p ON e.person_id = p.id
		JOIN metrics m ON e.metric_id = m.id
		WHERE e.season_id = ? AND e.person_id = ? AND e.deleted_at IS NULL
		ORDER BY e.entry_date DESC, e.created_at DESC
		LIMIT ?
	`).all(seasonId, personId, limit) as EntryWithNames[];
}

// Get weekly comparison stats (this week vs last week)
export function getWeeklyComparison(seasonId: number): { person_id: number; metric_id: number; this_week: number; last_week: number }[] {
	const now = new Date();
	const dayOfWeek = now.getDay(); // 0 = Sunday
	const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	
	const thisMonday = new Date(now);
	thisMonday.setDate(now.getDate() + mondayOffset);
	thisMonday.setHours(0, 0, 0, 0);
	
	const lastMonday = new Date(thisMonday);
	lastMonday.setDate(thisMonday.getDate() - 7);
	
	const lastSunday = new Date(thisMonday);
	lastSunday.setDate(thisMonday.getDate() - 1);
	
	const thisMondayStr = thisMonday.toISOString().split('T')[0];
	const lastMondayStr = lastMonday.toISOString().split('T')[0];
	const lastSundayStr = lastSunday.toISOString().split('T')[0];
	const todayStr = now.toISOString().split('T')[0];
	
	return db.prepare(`
		SELECT 
			p.id as person_id,
			m.id as metric_id,
			COALESCE(SUM(CASE WHEN e.entry_date >= ? AND e.entry_date <= ? THEN 1 ELSE 0 END), 0) as this_week,
			COALESCE(SUM(CASE WHEN e.entry_date >= ? AND e.entry_date <= ? THEN 1 ELSE 0 END), 0) as last_week
		FROM people p
		CROSS JOIN metrics m
		LEFT JOIN entries e ON e.person_id = p.id AND e.metric_id = m.id AND e.season_id = ? AND e.deleted_at IS NULL
		WHERE p.is_active = 1 AND m.is_active = 1
		GROUP BY p.id, m.id
	`).all(thisMondayStr, todayStr, lastMondayStr, lastSundayStr, seasonId) as { person_id: number; metric_id: number; this_week: number; last_week: number }[];
}

// Calculate current streak for each person/metric (consecutive days with at least one entry)
export function getStreaksSimple(seasonId: number): { person_id: number; metric_id: number; current_streak: number; longest_streak: number }[] {
	const today = new Date();
	const results: { person_id: number; metric_id: number; current_streak: number; longest_streak: number }[] = [];
	
	// Get all active people and metrics
	const people = db.prepare('SELECT id FROM people WHERE is_active = 1').all() as { id: number }[];
	const metrics = db.prepare('SELECT id FROM metrics WHERE is_active = 1').all() as { id: number }[];
	
	for (const person of people) {
		for (const metric of metrics) {
			// Get all entry dates for this person/metric, ordered descending
			const entries = db.prepare(`
				SELECT DISTINCT entry_date 
				FROM entries 
				WHERE season_id = ? AND person_id = ? AND metric_id = ? AND deleted_at IS NULL
				ORDER BY entry_date DESC
			`).all(seasonId, person.id, metric.id) as { entry_date: string }[];
			
			const entryDates = new Set(entries.map(e => e.entry_date));
			
			// Calculate current streak (from today backwards)
			let currentStreak = 0;
			let checkDate = new Date(today);
			
			// Check if today has an entry, if not check yesterday
			const todayStr = checkDate.toISOString().split('T')[0];
			if (!entryDates.has(todayStr)) {
				checkDate.setDate(checkDate.getDate() - 1);
			}
			
			while (true) {
				const dateStr = checkDate.toISOString().split('T')[0];
				if (entryDates.has(dateStr)) {
					currentStreak++;
					checkDate.setDate(checkDate.getDate() - 1);
				} else {
					break;
				}
			}
			
			// Calculate longest streak
			let longestStreak = 0;
			let tempStreak = 0;
			const sortedDates = Array.from(entryDates).sort();
			
			for (let i = 0; i < sortedDates.length; i++) {
				if (i === 0) {
					tempStreak = 1;
				} else {
					const prevDate = new Date(sortedDates[i - 1]);
					const currDate = new Date(sortedDates[i]);
					const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
					
					if (diffDays === 1) {
						tempStreak++;
					} else {
						longestStreak = Math.max(longestStreak, tempStreak);
						tempStreak = 1;
					}
				}
			}
			longestStreak = Math.max(longestStreak, tempStreak);
			
			if (currentStreak > 0 || longestStreak > 0) {
				results.push({
					person_id: person.id,
					metric_id: metric.id,
					current_streak: currentStreak,
					longest_streak: longestStreak
				});
			}
		}
	}
	
	return results;
}

// Get goals with current progress
export function getGoalsWithProgress(seasonId: number): { person_id: number; metric_id: number; target: number; current: number; person_name: string; metric_name: string }[] {
	return db.prepare(`
		SELECT 
			g.person_id,
			g.metric_id,
			g.target,
			p.name as person_name,
			m.name as metric_name,
			COUNT(e.id) as current
		FROM goals g
		JOIN people p ON g.person_id = p.id
		JOIN metrics m ON g.metric_id = m.id
		LEFT JOIN entries e ON e.person_id = g.person_id AND e.metric_id = g.metric_id AND e.season_id = g.season_id AND e.deleted_at IS NULL
		WHERE g.season_id = ?
		GROUP BY g.person_id, g.metric_id
		ORDER BY p.name, m.name
	`).all(seasonId) as { person_id: number; metric_id: number; target: number; current: number; person_name: string; metric_name: string }[];
}

// Get stats filtered by time period
export function getSeasonStatsFiltered(seasonId: number, period: 'today' | 'week' | 'month' | 'all'): { person_id: number; person_name: string; metric_id: number; metric_name: string; count: number }[] {
	const now = new Date();
	let startDate: string;
	
	switch (period) {
		case 'today':
			startDate = now.toISOString().split('T')[0];
			break;
		case 'week':
			const dayOfWeek = now.getDay();
			const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
			const monday = new Date(now);
			monday.setDate(now.getDate() + mondayOffset);
			startDate = monday.toISOString().split('T')[0];
			break;
		case 'month':
			startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
			break;
		case 'all':
		default:
			startDate = '1970-01-01';
			break;
	}
	
	const endDate = now.toISOString().split('T')[0];
	
	return db.prepare(`
		SELECT 
			p.id as person_id,
			p.name as person_name,
			m.id as metric_id,
			m.name as metric_name,
			COUNT(e.id) as count
		FROM people p
		CROSS JOIN metrics m
		LEFT JOIN entries e ON e.person_id = p.id AND e.metric_id = m.id AND e.season_id = ? AND e.entry_date >= ? AND e.entry_date <= ? AND e.deleted_at IS NULL
		WHERE p.is_active = 1 AND m.is_active = 1
		GROUP BY p.id, m.id
		ORDER BY p.name, m.name
	`).all(seasonId, startDate, endDate) as { person_id: number; person_name: string; metric_id: number; metric_name: string; count: number }[];
}

export function checkDuplicateEntry(seasonId: number, personId: number, metricId: number, entryDate: string): EntryWithNames | null {
	const existing = db.prepare(`
		SELECT e.*, p.name as person_name, p.emoji as person_emoji, m.name as metric_name
		FROM entries e
		JOIN people p ON e.person_id = p.id
		JOIN metrics m ON e.metric_id = m.id
		WHERE e.season_id = ? AND e.person_id = ? AND e.metric_id = ? AND e.entry_date = ? AND e.deleted_at IS NULL
		LIMIT 1
	`).get(seasonId, personId, metricId, entryDate) as EntryWithNames | undefined;
	return existing || null;
}

// Audit log helper
function logAudit(entryId: number, action: 'create' | 'update' | 'delete' | 'undelete', performedBy: 'tracker' | 'admin', oldValues?: object, newValues?: object): void {
	db.prepare(`
		INSERT INTO entry_audit (entry_id, action, old_values, new_values, performed_by)
		VALUES (?, ?, ?, ?, ?)
	`).run(
		entryId,
		action,
		oldValues ? JSON.stringify(oldValues) : null,
		newValues ? JSON.stringify(newValues) : null,
		performedBy
	);
}

export function createEntry(seasonId: number, personId: number, metricId: number, entryDate: string, notes?: string, tags?: string, performedBy: 'tracker' | 'admin' = 'tracker'): Entry {
	const result = db.prepare(`
		INSERT INTO entries (season_id, person_id, metric_id, entry_date, notes, tags)
		VALUES (?, ?, ?, ?, ?, ?)
	`).run(seasonId, personId, metricId, entryDate, notes || null, tags || null);
	
	const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(result.lastInsertRowid) as Entry;
	
	// Log the creation
	logAudit(entry.id, 'create', performedBy, undefined, {
		season_id: seasonId,
		person_id: personId,
		metric_id: metricId,
		entry_date: entryDate,
		notes: notes || null,
		tags: tags || null
	});
	
	return entry;
}

export function updateEntry(id: number, personId: number, metricId: number, entryDate: string, performedBy: 'tracker' | 'admin' = 'tracker'): void {
	// Get old values first
	const oldEntry = db.prepare('SELECT * FROM entries WHERE id = ?').get(id) as Entry;
	
	db.prepare('UPDATE entries SET person_id = ?, metric_id = ?, entry_date = ? WHERE id = ?')
		.run(personId, metricId, entryDate, id);
	
	// Log the update
	logAudit(id, 'update', performedBy, {
		person_id: oldEntry.person_id,
		metric_id: oldEntry.metric_id,
		entry_date: oldEntry.entry_date
	}, {
		person_id: personId,
		metric_id: metricId,
		entry_date: entryDate
	});
}

export function softDeleteEntry(id: number, performedBy: 'tracker' | 'admin' = 'admin'): void {
	const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(id) as Entry;
	
	db.prepare('UPDATE entries SET deleted_at = datetime("now") WHERE id = ?').run(id);
	
	// Log the deletion
	logAudit(id, 'delete', performedBy, {
		person_id: entry.person_id,
		metric_id: entry.metric_id,
		entry_date: entry.entry_date,
		notes: entry.notes
	});
}

export function softDeleteEntries(ids: number[], performedBy: 'tracker' | 'admin' = 'admin'): void {
	for (const id of ids) {
		softDeleteEntry(id, performedBy);
	}
}

export function undeleteEntry(id: number, performedBy: 'tracker' | 'admin' = 'admin'): void {
	const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(id) as Entry;
	
	db.prepare('UPDATE entries SET deleted_at = NULL WHERE id = ?').run(id);
	
	// Log the undelete
	logAudit(id, 'undelete', performedBy, undefined, {
		person_id: entry.person_id,
		metric_id: entry.metric_id,
		entry_date: entry.entry_date,
		notes: entry.notes
	});
}

export function undeleteEntries(ids: number[], performedBy: 'tracker' | 'admin' = 'admin'): void {
	for (const id of ids) {
		undeleteEntry(id, performedBy);
	}
}

// Keep old function names for compatibility but they now do soft delete
export function deleteEntry(id: number): void {
	softDeleteEntry(id, 'admin');
}

export function deleteEntries(ids: number[]): void {
	softDeleteEntries(ids, 'admin');
}

// Get audit log for an entry
export function getEntryAuditLog(entryId: number): EntryAudit[] {
	return db.prepare(`
		SELECT * FROM entry_audit WHERE entry_id = ? ORDER BY performed_at DESC
	`).all(entryId) as EntryAudit[];
}

// Get all audit logs for admin view
export function getAllAuditLogs(limit = 100): (EntryAudit & { person_name: string; metric_name: string })[] {
	return db.prepare(`
		SELECT ea.*, p.name as person_name, m.name as metric_name
		FROM entry_audit ea
		JOIN entries e ON ea.entry_id = e.id
		JOIN people p ON e.person_id = p.id
		JOIN metrics m ON e.metric_id = m.id
		ORDER BY ea.performed_at DESC
		LIMIT ?
	`).all(limit) as (EntryAudit & { person_name: string; metric_name: string })[];
}

export function getSeasonStats(seasonId: number): { person_id: number; person_name: string; metric_id: number; metric_name: string; count: number }[] {
	return db.prepare(`
		SELECT 
			p.id as person_id,
			p.name as person_name,
			m.id as metric_id,
			m.name as metric_name,
			COUNT(e.id) as count
		FROM people p
		CROSS JOIN metrics m
		LEFT JOIN entries e ON e.person_id = p.id AND e.metric_id = m.id AND e.season_id = ? AND e.deleted_at IS NULL
		WHERE p.is_active = 1 AND m.is_active = 1
		GROUP BY p.id, m.id
		ORDER BY p.name, m.name
	`).all(seasonId) as { person_id: number; person_name: string; metric_id: number; metric_name: string; count: number }[];
}

export function getSeasonStatsInRange(seasonId: number, startDate: string, endDate: string): { person_id: number; person_name: string; person_emoji: string; metric_id: number; metric_name: string; count: number }[] {
	return db.prepare(`
		SELECT 
			p.id as person_id,
			p.name as person_name,
			p.emoji as person_emoji,
			m.id as metric_id,
			m.name as metric_name,
			COUNT(e.id) as count
		FROM people p
		CROSS JOIN metrics m
		LEFT JOIN entries e ON e.person_id = p.id AND e.metric_id = m.id AND e.season_id = ? AND e.entry_date >= ? AND e.entry_date <= ? AND e.deleted_at IS NULL
		WHERE p.is_active = 1 AND m.is_active = 1
		GROUP BY p.id, m.id
		ORDER BY p.name, m.name
	`).all(seasonId, startDate, endDate) as { person_id: number; person_name: string; person_emoji: string; metric_id: number; metric_name: string; count: number }[];
}

export function exportAllData() {
	return {
		seasons: db.prepare('SELECT * FROM seasons').all(),
		people: db.prepare('SELECT * FROM people').all(),
		metrics: db.prepare('SELECT * FROM metrics').all(),
		entries: db.prepare('SELECT * FROM entries').all(),
		entry_audit: db.prepare('SELECT * FROM entry_audit').all(),
		settings: db.prepare('SELECT key, updated_at FROM settings').all(), // Don't export PIN values!
		exportedAt: new Date().toISOString()
	};
}

export interface ImportData {
	seasons?: Array<{ id: number; year: number; name: string; is_active: number; created_at: string }>;
	people?: Array<{ id: number; name: string; emoji: string; is_active: number; created_at: string }>;
	metrics?: Array<{ id: number; name: string; emoji: string; is_active: number; created_at: string }>;
	entries?: Array<{ id: number; person_id: number; metric_id: number; season_id: number; value: number; date: string; notes: string | null; created_at: string; updated_at: string }>;
	entry_audit?: Array<{ id: number; entry_id: number; action: string; old_value: string | null; new_value: string | null; changed_at: string; changed_by: string }>;
	exportedAt?: string;
}

export function importAllData(data: ImportData, mode: 'merge' | 'replace' = 'merge'): { success: boolean; imported: Record<string, number>; errors: string[] } {
	const imported: Record<string, number> = {};
	const errors: string[] = [];
	
	try {
		db.exec('BEGIN TRANSACTION');
		
		if (mode === 'replace') {
			// Clear existing data (in reverse order of dependencies)
			db.exec('DELETE FROM entry_audit');
			db.exec('DELETE FROM entries');
			db.exec('DELETE FROM goals');
			db.exec('DELETE FROM country_visits');
			db.exec('DELETE FROM metrics');
			db.exec('DELETE FROM people');
			db.exec('DELETE FROM seasons');
		}
		
		// Import seasons
		if (data.seasons && data.seasons.length > 0) {
			const insertSeason = db.prepare(`
				INSERT OR REPLACE INTO seasons (id, year, name, is_active, created_at)
				VALUES (?, ?, ?, ?, ?)
			`);
			for (const season of data.seasons) {
				try {
					insertSeason.run(season.id, season.year, season.name, season.is_active, season.created_at);
					imported.seasons = (imported.seasons || 0) + 1;
				} catch (e) {
					errors.push(`Season ${season.year}: ${(e as Error).message}`);
				}
			}
		}
		
		// Import people
		if (data.people && data.people.length > 0) {
			const insertPerson = db.prepare(`
				INSERT OR REPLACE INTO people (id, name, emoji, is_active, created_at)
				VALUES (?, ?, ?, ?, ?)
			`);
			for (const person of data.people) {
				try {
					insertPerson.run(person.id, person.name, person.emoji, person.is_active, person.created_at);
					imported.people = (imported.people || 0) + 1;
				} catch (e) {
					errors.push(`Person ${person.name}: ${(e as Error).message}`);
				}
			}
		}
		
		// Import metrics
		if (data.metrics && data.metrics.length > 0) {
			const insertMetric = db.prepare(`
				INSERT OR REPLACE INTO metrics (id, name, emoji, is_active, created_at)
				VALUES (?, ?, ?, ?, ?)
			`);
			for (const metric of data.metrics) {
				try {
					insertMetric.run(metric.id, metric.name, metric.emoji, metric.is_active, metric.created_at);
					imported.metrics = (imported.metrics || 0) + 1;
				} catch (e) {
					errors.push(`Metric ${metric.name}: ${(e as Error).message}`);
				}
			}
		}
		
		// Import entries
		if (data.entries && data.entries.length > 0) {
			const insertEntry = db.prepare(`
				INSERT OR REPLACE INTO entries (id, person_id, metric_id, season_id, value, date, notes, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`);
			for (const entry of data.entries) {
				try {
					insertEntry.run(entry.id, entry.person_id, entry.metric_id, entry.season_id, entry.value, entry.date, entry.notes, entry.created_at, entry.updated_at);
					imported.entries = (imported.entries || 0) + 1;
				} catch (e) {
					errors.push(`Entry ${entry.id}: ${(e as Error).message}`);
				}
			}
		}
		
		// Import entry_audit
		if (data.entry_audit && data.entry_audit.length > 0) {
			const insertAudit = db.prepare(`
				INSERT OR REPLACE INTO entry_audit (id, entry_id, action, old_value, new_value, changed_at, changed_by)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`);
			for (const audit of data.entry_audit) {
				try {
					insertAudit.run(audit.id, audit.entry_id, audit.action, audit.old_value, audit.new_value, audit.changed_at, audit.changed_by);
					imported.entry_audit = (imported.entry_audit || 0) + 1;
				} catch (e) {
					errors.push(`Audit ${audit.id}: ${(e as Error).message}`);
				}
			}
		}
		
		db.exec('COMMIT');
		return { success: true, imported, errors };
	} catch (e) {
		db.exec('ROLLBACK');
		return { success: false, imported, errors: [...errors, (e as Error).message] };
	}
}

// PIN management functions
export function validatePin(pin: string): 'tracker' | 'admin' | null {
	const trackerPin = getSetting('tracker_pin');
	const adminPin = getSetting('admin_pin');
	
	if (pin === trackerPin) return 'tracker';
	if (pin === adminPin) return 'admin';
	return null;
}

export function changeTrackerPin(newPin: string): { success: boolean; error?: string } {
	if (!newPin || newPin.length < 4) {
		return { success: false, error: 'PIN must be at least 4 characters' };
	}
	
	const adminPin = getSetting('admin_pin');
	if (newPin === adminPin) {
		return { success: false, error: 'Tracker PIN cannot be the same as Admin PIN' };
	}
	
	setSetting('tracker_pin', newPin);
	return { success: true };
}

export function changeAdminPin(newPin: string): { success: boolean; error?: string } {
	if (!newPin || newPin.length < 4) {
		return { success: false, error: 'PIN must be at least 4 characters' };
	}
	
	const trackerPin = getSetting('tracker_pin');
	if (newPin === trackerPin) {
		return { success: false, error: 'Admin PIN cannot be the same as Tracker PIN' };
	}
	
	setSetting('admin_pin', newPin);
	return { success: true };
}

// Goal management functions
export function getGoalsForSeason(seasonId: number): GoalWithNames[] {
	return db.prepare(`
		SELECT g.*, p.name as person_name, p.emoji as person_emoji, m.name as metric_name, m.emoji as metric_emoji
		FROM goals g
		JOIN people p ON g.person_id = p.id
		JOIN metrics m ON g.metric_id = m.id
		WHERE g.season_id = ?
		ORDER BY p.name, m.name
	`).all(seasonId) as GoalWithNames[];
}

export function getGoal(seasonId: number, personId: number, metricId: number): Goal | undefined {
	return db.prepare(`
		SELECT * FROM goals WHERE season_id = ? AND person_id = ? AND metric_id = ?
	`).get(seasonId, personId, metricId) as Goal | undefined;
}

export function setGoal(seasonId: number, personId: number, metricId: number, target: number): Goal {
	db.prepare(`
		INSERT INTO goals (season_id, person_id, metric_id, target)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(season_id, person_id, metric_id) 
		DO UPDATE SET target = excluded.target, updated_at = datetime('now')
	`).run(seasonId, personId, metricId, target);
	
	return db.prepare(`
		SELECT * FROM goals WHERE season_id = ? AND person_id = ? AND metric_id = ?
	`).get(seasonId, personId, metricId) as Goal;
}

export function deleteGoal(seasonId: number, personId: number, metricId: number): void {
	db.prepare(`DELETE FROM goals WHERE season_id = ? AND person_id = ? AND metric_id = ?`).run(seasonId, personId, metricId);
}

// Countries visited functions
export function getCountriesVisitedForSeason(seasonId: number): CountryVisitWithPerson[] {
	return db.prepare(`
		SELECT cv.*, p.name as person_name, p.emoji as person_emoji
		FROM countries_visited cv
		JOIN people p ON cv.person_id = p.id
		WHERE cv.season_id = ?
		ORDER BY p.name, cv.country_name
	`).all(seasonId) as CountryVisitWithPerson[];
}

export function getCountriesForPerson(seasonId: number, personId: number): CountryVisit[] {
	return db.prepare(`
		SELECT * FROM countries_visited 
		WHERE season_id = ? AND person_id = ?
		ORDER BY country_name
	`).all(seasonId, personId) as CountryVisit[];
}

export function addCountryVisit(seasonId: number, personId: number, countryCode: string, countryName: string): CountryVisit {
	db.prepare(`
		INSERT OR IGNORE INTO countries_visited (season_id, person_id, country_code, country_name)
		VALUES (?, ?, ?, ?)
	`).run(seasonId, personId, countryCode.toUpperCase(), countryName);
	
	return db.prepare(`
		SELECT * FROM countries_visited WHERE season_id = ? AND person_id = ? AND country_code = ?
	`).get(seasonId, personId, countryCode.toUpperCase()) as CountryVisit;
}

export function removeCountryVisit(seasonId: number, personId: number, countryCode: string): void {
	db.prepare(`
		DELETE FROM countries_visited WHERE season_id = ? AND person_id = ? AND country_code = ?
	`).run(seasonId, personId, countryCode.toUpperCase());
}

export function getCountriesStats(seasonId: number): { person_id: number; person_name: string; person_emoji: string; country_count: number; countries: string[] }[] {
	const visits = db.prepare(`
		SELECT cv.person_id, p.name as person_name, p.emoji as person_emoji, cv.country_name, cv.country_code
		FROM countries_visited cv
		JOIN people p ON cv.person_id = p.id
		WHERE cv.season_id = ?
		ORDER BY p.name, cv.country_name
	`).all(seasonId) as { person_id: number; person_name: string; person_emoji: string; country_name: string; country_code: string }[];

	const grouped = new Map<number, { person_name: string; person_emoji: string; countries: string[] }>();
	
	for (const visit of visits) {
		if (!grouped.has(visit.person_id)) {
			grouped.set(visit.person_id, { person_name: visit.person_name, person_emoji: visit.person_emoji, countries: [] });
		}
		grouped.get(visit.person_id)!.countries.push(visit.country_name);
	}

	return [...grouped.entries()].map(([person_id, data]) => ({
		person_id,
		person_name: data.person_name,
		person_emoji: data.person_emoji,
		country_count: data.countries.length,
		countries: data.countries
	})).sort((a, b) => b.country_count - a.country_count);
}

// Stats functions for monthly overview and trends
export function getMonthlyStats(seasonId: number): { month: string; person_id: number; person_name: string; person_emoji: string; metric_id: number; metric_name: string; count: number }[] {
	return db.prepare(`
		SELECT 
			strftime('%Y-%m', e.entry_date) as month,
			p.id as person_id,
			p.name as person_name,
			p.emoji as person_emoji,
			m.id as metric_id,
			m.name as metric_name,
			COUNT(e.id) as count
		FROM entries e
		JOIN people p ON e.person_id = p.id
		JOIN metrics m ON e.metric_id = m.id
		WHERE e.season_id = ? AND e.deleted_at IS NULL
		GROUP BY month, p.id, m.id
		ORDER BY month, p.name, m.name
	`).all(seasonId) as { month: string; person_id: number; person_name: string; person_emoji: string; metric_id: number; metric_name: string; count: number }[];
}

export function getDailyStats(seasonId: number): { date: string; person_id: number; person_name: string; count: number }[] {
	return db.prepare(`
		SELECT 
			e.entry_date as date,
			p.id as person_id,
			p.name as person_name,
			COUNT(e.id) as count
		FROM entries e
		JOIN people p ON e.person_id = p.id
		WHERE e.season_id = ? AND e.deleted_at IS NULL
		GROUP BY e.entry_date, p.id
		ORDER BY e.entry_date
	`).all(seasonId) as { date: string; person_id: number; person_name: string; count: number }[];
}

export function getWeeklyStats(seasonId: number): { week: string; person_id: number; metric_id: number; count: number }[] {
	return db.prepare(`
		SELECT 
			strftime('%Y-W%W', e.entry_date) as week,
			e.person_id,
			e.metric_id,
			COUNT(e.id) as count
		FROM entries e
		WHERE e.season_id = ? AND e.deleted_at IS NULL
		GROUP BY week, e.person_id, e.metric_id
		ORDER BY week
	`).all(seasonId) as { week: string; person_id: number; metric_id: number; count: number }[];
}

// Enhanced streak data structure
export interface StreakData {
	person_id: number;
	person_name: string;
	person_emoji: string;
	// Daily streaks
	current_daily_streak: number;
	longest_daily_streak: number;
	longest_daily_streak_start: string | null;
	longest_daily_streak_end: string | null;
	// Weekly streaks  
	current_weekly_streak: number;
	longest_weekly_streak: number;
	longest_weekly_streak_start: string | null;
	longest_weekly_streak_end: string | null;
	// Monthly streaks
	current_monthly_streak: number;
	longest_monthly_streak: number;
	// Fun stats
	total_entries: number;
	busiest_day: string | null; // Day of week
	busiest_month: string | null;
	first_entry: string | null;
	last_entry: string | null;
	entries_per_week_avg: number;
}

// Streak calculation - returns comprehensive streak data per person per metric
export function getStreaks(seasonId: number, metricId: number): StreakData[] {
	// Get all entries for this metric, ordered by person and date
	const entries = db.prepare(`
		SELECT e.person_id, p.name as person_name, p.emoji as person_emoji, e.entry_date
		FROM entries e
		JOIN people p ON e.person_id = p.id
		WHERE e.season_id = ? AND e.metric_id = ? AND e.deleted_at IS NULL
		ORDER BY e.person_id, e.entry_date
	`).all(seasonId, metricId) as { person_id: number; person_name: string; person_emoji: string; entry_date: string }[];
	
	// Group by person
	const byPerson = new Map<number, { name: string; emoji: string; dates: string[] }>();
	for (const entry of entries) {
		if (!byPerson.has(entry.person_id)) {
			byPerson.set(entry.person_id, { name: entry.person_name, emoji: entry.person_emoji, dates: [] });
		}
		byPerson.get(entry.person_id)!.dates.push(entry.entry_date);
	}
	
	const today = new Date().toISOString().split('T')[0];
	const results: StreakData[] = [];
	
	for (const [personId, data] of byPerson) {
		// Get unique dates sorted
		const uniqueDates = [...new Set(data.dates)].sort();
		if (uniqueDates.length === 0) {
			results.push(createEmptyStreakData(personId, data.name, data.emoji));
			continue;
		}
		
		// Calculate daily streaks
		const dailyStreaks = calculateDailyStreaks(uniqueDates, today);
		
		// Calculate weekly streaks
		const weeklyStreaks = calculateWeeklyStreaks(uniqueDates);
		
		// Calculate monthly streaks
		const monthlyStreaks = calculateMonthlyStreaks(uniqueDates);
		
		// Calculate fun stats
		const funStats = calculateFunStats(data.dates, uniqueDates);
		
		results.push({
			person_id: personId,
			person_name: data.name,
			person_emoji: data.emoji,
			...dailyStreaks,
			...weeklyStreaks,
			...monthlyStreaks,
			...funStats
		});
	}
	
	// Add people with no entries
	const allPeople = getActivePeople();
	for (const person of allPeople) {
		if (!byPerson.has(person.id)) {
			results.push(createEmptyStreakData(person.id, person.name, person.emoji));
		}
	}
	
	return results.sort((a, b) => a.person_name.localeCompare(b.person_name));
}

function createEmptyStreakData(personId: number, name: string, emoji: string): StreakData {
	return {
		person_id: personId,
		person_name: name,
		person_emoji: emoji,
		current_daily_streak: 0,
		longest_daily_streak: 0,
		longest_daily_streak_start: null,
		longest_daily_streak_end: null,
		current_weekly_streak: 0,
		longest_weekly_streak: 0,
		longest_weekly_streak_start: null,
		longest_weekly_streak_end: null,
		current_monthly_streak: 0,
		longest_monthly_streak: 0,
		total_entries: 0,
		busiest_day: null,
		busiest_month: null,
		first_entry: null,
		last_entry: null,
		entries_per_week_avg: 0
	};
}

function calculateDailyStreaks(uniqueDates: string[], today: string) {
	let currentStreak = 0;
	let longestStreak = 0;
	let longestStart = uniqueDates[0];
	let longestEnd = uniqueDates[0];
	let streak = 1;
	let streakStart = uniqueDates[0];
	
	for (let i = 1; i < uniqueDates.length; i++) {
		const prevDate = new Date(uniqueDates[i - 1]);
		const currDate = new Date(uniqueDates[i]);
		const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
		
		if (diffDays === 1) {
			streak++;
		} else {
			if (streak > longestStreak) {
				longestStreak = streak;
				longestStart = streakStart;
				longestEnd = uniqueDates[i - 1];
			}
			streak = 1;
			streakStart = uniqueDates[i];
		}
	}
	
	// Check final streak
	if (streak > longestStreak) {
		longestStreak = streak;
		longestStart = streakStart;
		longestEnd = uniqueDates[uniqueDates.length - 1];
	}
	
	// Check if current streak is active (includes today or yesterday)
	const lastDate = uniqueDates[uniqueDates.length - 1];
	const lastDateObj = new Date(lastDate);
	const todayObj = new Date(today);
	const diffToToday = Math.round((todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));
	
	if (diffToToday <= 1) {
		currentStreak = streak;
	}
	
	return {
		current_daily_streak: currentStreak,
		longest_daily_streak: longestStreak,
		longest_daily_streak_start: longestStart,
		longest_daily_streak_end: longestEnd
	};
}

function getWeekKey(date: Date): string {
	const year = date.getFullYear();
	const week = Math.ceil((((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
	return `${year}-W${week.toString().padStart(2, '0')}`;
}

function calculateWeeklyStreaks(uniqueDates: string[]) {
	const weeks = [...new Set(uniqueDates.map(d => getWeekKey(new Date(d))))].sort();
	
	if (weeks.length === 0) {
		return {
			current_weekly_streak: 0,
			longest_weekly_streak: 0,
			longest_weekly_streak_start: null,
			longest_weekly_streak_end: null
		};
	}
	
	let currentStreak = 0;
	let longestStreak = 1;
	let longestStart = weeks[0];
	let longestEnd = weeks[0];
	let streak = 1;
	let streakStart = weeks[0];
	
	for (let i = 1; i < weeks.length; i++) {
		const [prevYear, prevW] = weeks[i - 1].split('-W').map(Number);
		const [currYear, currW] = weeks[i].split('-W').map(Number);
		
		const isConsecutive = (currYear === prevYear && currW === prevW + 1) || 
			(currYear === prevYear + 1 && prevW >= 52 && currW === 1);
		
		if (isConsecutive) {
			streak++;
		} else {
			if (streak > longestStreak) {
				longestStreak = streak;
				longestStart = streakStart;
				longestEnd = weeks[i - 1];
			}
			streak = 1;
			streakStart = weeks[i];
		}
	}
	
	// Check final streak
	if (streak > longestStreak) {
		longestStreak = streak;
		longestStart = streakStart;
		longestEnd = weeks[weeks.length - 1];
	}
	
	// Check if current streak is active
	const now = new Date();
	const currentWeekKey = getWeekKey(now);
	const lastWeek = weeks[weeks.length - 1];
	const [lastYear, lastW] = lastWeek.split('-W').map(Number);
	const [currYear, currW] = currentWeekKey.split('-W').map(Number);
	
	const isCurrentOrPrevious = lastWeek === currentWeekKey || 
		(currYear === lastYear && currW === lastW + 1) ||
		(currYear === lastYear + 1 && lastW >= 52 && currW === 1);
	
	if (isCurrentOrPrevious) {
		currentStreak = streak;
	}
	
	return {
		current_weekly_streak: currentStreak,
		longest_weekly_streak: longestStreak,
		longest_weekly_streak_start: longestStart,
		longest_weekly_streak_end: longestEnd
	};
}

function calculateMonthlyStreaks(uniqueDates: string[]) {
	const months = [...new Set(uniqueDates.map(d => d.substring(0, 7)))].sort();
	
	if (months.length === 0) {
		return { current_monthly_streak: 0, longest_monthly_streak: 0 };
	}
	
	let currentStreak = 0;
	let longestStreak = 1;
	let streak = 1;
	
	for (let i = 1; i < months.length; i++) {
		const [prevYear, prevM] = months[i - 1].split('-').map(Number);
		const [currYear, currM] = months[i].split('-').map(Number);
		
		const isConsecutive = (currYear === prevYear && currM === prevM + 1) || 
			(currYear === prevYear + 1 && prevM === 12 && currM === 1);
		
		if (isConsecutive) {
			streak++;
		} else {
			longestStreak = Math.max(longestStreak, streak);
			streak = 1;
		}
	}
	longestStreak = Math.max(longestStreak, streak);
	
	// Check if current streak is active
	const now = new Date();
	const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
	const lastMonth = months[months.length - 1];
	const [lastYear, lastM] = lastMonth.split('-').map(Number);
	const [currYear, currM] = currentMonth.split('-').map(Number);
	
	const isCurrentOrPrevious = lastMonth === currentMonth || 
		(currYear === lastYear && currM === lastM + 1) ||
		(currYear === lastYear + 1 && lastM === 12 && currM === 1);
	
	if (isCurrentOrPrevious) {
		currentStreak = streak;
	}
	
	return { current_monthly_streak: currentStreak, longest_monthly_streak: longestStreak };
}

function calculateFunStats(allDates: string[], uniqueDates: string[]) {
	const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	
	// Count by day of week
	const dayCounts: Record<string, number> = {};
	for (const date of allDates) {
		const day = dayOfWeek[new Date(date).getDay()];
		dayCounts[day] = (dayCounts[day] || 0) + 1;
	}
	const busiestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
	
	// Count by month
	const monthCounts: Record<string, number> = {};
	for (const date of allDates) {
		const month = monthNames[new Date(date).getMonth()];
		monthCounts[month] = (monthCounts[month] || 0) + 1;
	}
	const busiestMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
	
	// Calculate entries per week average
	const firstEntry = uniqueDates[0];
	const lastEntry = uniqueDates[uniqueDates.length - 1];
	const weekSpan = Math.max(1, Math.ceil((new Date(lastEntry).getTime() - new Date(firstEntry).getTime()) / (7 * 24 * 60 * 60 * 1000)));
	const entriesPerWeekAvg = Math.round((allDates.length / weekSpan) * 10) / 10;
	
	return {
		total_entries: allDates.length,
		busiest_day: busiestDay,
		busiest_month: busiestMonth,
		first_entry: firstEntry,
		last_entry: lastEntry,
		entries_per_week_avg: entriesPerWeekAvg
	};
}

// Achievement functions
export interface UnlockedAchievement {
	key: string;
	unlocked_at: string;
}

export function getPersonAchievements(seasonId: number, personId: number): UnlockedAchievement[] {
	return db.prepare(`
		SELECT achievement_key as key, unlocked_at
		FROM achievements
		WHERE season_id = ? AND person_id = ?
		ORDER BY unlocked_at DESC
	`).all(seasonId, personId) as UnlockedAchievement[];
}

export function unlockAchievement(seasonId: number, personId: number, achievementKey: string): boolean {
	try {
		db.prepare(`
			INSERT OR IGNORE INTO achievements (season_id, person_id, achievement_key)
			VALUES (?, ?, ?)
		`).run(seasonId, personId, achievementKey);
		return true;
	} catch {
		return false;
	}
}

export function checkAndUnlockAchievements(seasonId: number, personId: number): string[] {
	const newlyUnlocked: string[] = [];
	const existing = new Set(getPersonAchievements(seasonId, personId).map(a => a.key));
	
	// Get person's entries
	const entries = db.prepare(`
		SELECT e.*, m.name as metric_name
		FROM entries e
		JOIN metrics m ON e.metric_id = m.id
		WHERE e.season_id = ? AND e.person_id = ? AND e.deleted_at IS NULL
		ORDER BY e.entry_date
	`).all(seasonId, personId) as { entry_date: string; metric_name: string }[];
	
	const totalEntries = entries.length;
	const uniqueDates = [...new Set(entries.map(e => e.entry_date))].sort();
	const uniqueMetrics = new Set(entries.map(e => e.metric_name));
	
	// First entry
	if (totalEntries >= 1 && !existing.has('first_entry')) {
		unlockAchievement(seasonId, personId, 'first_entry');
		newlyUnlocked.push('first_entry');
	}
	
	// Entry milestones
	const milestones = [
		{ count: 10, key: 'entries_10' },
		{ count: 25, key: 'entries_25' },
		{ count: 50, key: 'entries_50' },
		{ count: 100, key: 'entries_100' },
		{ count: 200, key: 'entries_200' }
	];
	
	for (const { count, key } of milestones) {
		if (totalEntries >= count && !existing.has(key)) {
			unlockAchievement(seasonId, personId, key);
			newlyUnlocked.push(key);
		}
	}
	
	// Daily streaks
	let maxStreak = 1;
	let currentStreak = 1;
	for (let i = 1; i < uniqueDates.length; i++) {
		const prev = new Date(uniqueDates[i - 1]);
		const curr = new Date(uniqueDates[i]);
		const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
		if (diff === 1) {
			currentStreak++;
			maxStreak = Math.max(maxStreak, currentStreak);
		} else {
			currentStreak = 1;
		}
	}
	
	const streakMilestones = [
		{ days: 3, key: 'streak_3d' },
		{ days: 7, key: 'streak_7d' },
		{ days: 14, key: 'streak_14d' },
		{ days: 30, key: 'streak_30d' }
	];
	
	for (const { days, key } of streakMilestones) {
		if (maxStreak >= days && !existing.has(key)) {
			unlockAchievement(seasonId, personId, key);
			newlyUnlocked.push(key);
		}
	}
	
	// Weekly streaks
	const weeks = [...new Set(uniqueDates.map(d => {
		const date = new Date(d);
		const year = date.getFullYear();
		const week = Math.ceil((((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
		return `${year}-W${week.toString().padStart(2, '0')}`;
	}))].sort();
	
	let maxWeeklyStreak = 1;
	let weeklyStreak = 1;
	for (let i = 1; i < weeks.length; i++) {
		const [prevYear, prevW] = weeks[i - 1].split('-W').map(Number);
		const [currYear, currW] = weeks[i].split('-W').map(Number);
		if ((currYear === prevYear && currW === prevW + 1) || (currYear === prevYear + 1 && prevW >= 52 && currW === 1)) {
			weeklyStreak++;
			maxWeeklyStreak = Math.max(maxWeeklyStreak, weeklyStreak);
		} else {
			weeklyStreak = 1;
		}
	}
	
	const weeklyMilestones = [
		{ weeks: 4, key: 'weekly_4' },
		{ weeks: 8, key: 'weekly_8' },
		{ weeks: 12, key: 'weekly_12' }
	];
	
	for (const { weeks: w, key } of weeklyMilestones) {
		if (maxWeeklyStreak >= w && !existing.has(key)) {
			unlockAchievement(seasonId, personId, key);
			newlyUnlocked.push(key);
		}
	}
	
	// Early bird (January entries)
	const hasJanuaryEntry = entries.some(e => e.entry_date.includes('-01-'));
	if (hasJanuaryEntry && !existing.has('early_bird')) {
		unlockAchievement(seasonId, personId, 'early_bird');
		newlyUnlocked.push('early_bird');
	}
	
	// All rounder (entries in all metrics)
	const activeMetrics = getActiveMetrics();
	if (uniqueMetrics.size >= activeMetrics.length && activeMetrics.length > 0 && !existing.has('all_rounder')) {
		unlockAchievement(seasonId, personId, 'all_rounder');
		newlyUnlocked.push('all_rounder');
	}
	
	// Consistency king (entries every month)
	const months = new Set(entries.map(e => e.entry_date.substring(0, 7)));
	const currentMonth = new Date().getMonth() + 1;
	if (months.size >= currentMonth && currentMonth > 1 && !existing.has('consistency_king')) {
		unlockAchievement(seasonId, personId, 'consistency_king');
		newlyUnlocked.push('consistency_king');
	}
	
	// Goal-based achievements
	const goals = getGoalsForSeason(seasonId).filter(g => g.person_id === personId);
	for (const goal of goals) {
		const metricEntries = entries.filter(e => {
			const metric = activeMetrics.find(m => m.name === e.metric_name);
			return metric?.id === goal.metric_id;
		}).length;
		
		// Perfectionist - hit goal exactly
		if (metricEntries === goal.target && !existing.has('perfectionist')) {
			unlockAchievement(seasonId, personId, 'perfectionist');
			newlyUnlocked.push('perfectionist');
		}
		
		// Goal crusher - exceed by 50%
		if (metricEntries >= goal.target * 1.5 && !existing.has('goal_crusher')) {
			unlockAchievement(seasonId, personId, 'goal_crusher');
			newlyUnlocked.push('goal_crusher');
		}
	}
	
	return newlyUnlocked;
}

// Enhanced stats data for improved stats page
export interface DayOfWeekStats {
	day: string;
	dayIndex: number;
	count: number;
	percentage: number;
}

export interface PersonalBest {
	type: string;
	value: number;
	date?: string;
	details?: string;
}

export interface ConsistencyData {
	person_id: number;
	person_name: string;
	person_emoji: string;
	total_weeks: number;
	active_weeks: number;
	consistency_percentage: number;
	weeks_with_4plus: number;
	longest_gap_days: number;
}

export function getDayOfWeekStats(seasonId: number): DayOfWeekStats[] {
	const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	
	const results = db.prepare(`
		SELECT 
			CAST(strftime('%w', entry_date) AS INTEGER) as day_index,
			COUNT(*) as count
		FROM entries
		WHERE season_id = ? AND deleted_at IS NULL
		GROUP BY day_index
		ORDER BY day_index
	`).all(seasonId) as { day_index: number; count: number }[];
	
	const totalEntries = results.reduce((sum, r) => sum + r.count, 0);
	
	// Fill in all days including zeros
	return dayNames.map((day, index) => {
		const found = results.find(r => r.day_index === index);
		const count = found?.count || 0;
		return {
			day,
			dayIndex: index,
			count,
			percentage: totalEntries > 0 ? Math.round((count / totalEntries) * 100) : 0
		};
	});
}

export function getPersonalBests(seasonId: number): Record<number, PersonalBest[]> {
	const people = getActivePeople();
	const results: Record<number, PersonalBest[]> = {};
	
	for (const person of people) {
		const bests: PersonalBest[] = [];
		
		// Best single day (most entries in one day)
		const bestDay = db.prepare(`
			SELECT entry_date, COUNT(*) as count
			FROM entries
			WHERE season_id = ? AND person_id = ? AND deleted_at IS NULL
			GROUP BY entry_date
			ORDER BY count DESC
			LIMIT 1
		`).get(seasonId, person.id) as { entry_date: string; count: number } | undefined;
		
		if (bestDay && bestDay.count > 0) {
			bests.push({
				type: 'best_day',
				value: bestDay.count,
				date: bestDay.entry_date,
				details: `${bestDay.count} entries on ${bestDay.entry_date}`
			});
		}
		
		// Best week
		const bestWeek = db.prepare(`
			SELECT strftime('%Y-W%W', entry_date) as week, COUNT(*) as count
			FROM entries
			WHERE season_id = ? AND person_id = ? AND deleted_at IS NULL
			GROUP BY week
			ORDER BY count DESC
			LIMIT 1
		`).get(seasonId, person.id) as { week: string; count: number } | undefined;
		
		if (bestWeek && bestWeek.count > 0) {
			bests.push({
				type: 'best_week',
				value: bestWeek.count,
				details: `${bestWeek.count} entries in ${bestWeek.week}`
			});
		}
		
		// Best month
		const bestMonth = db.prepare(`
			SELECT strftime('%Y-%m', entry_date) as month, COUNT(*) as count
			FROM entries
			WHERE season_id = ? AND person_id = ? AND deleted_at IS NULL
			GROUP BY month
			ORDER BY count DESC
			LIMIT 1
		`).get(seasonId, person.id) as { month: string; count: number } | undefined;
		
		if (bestMonth && bestMonth.count > 0) {
			bests.push({
				type: 'best_month',
				value: bestMonth.count,
				details: `${bestMonth.count} entries in ${bestMonth.month}`
			});
		}
		
		// Longest gap between entries
		const entries = db.prepare(`
			SELECT DISTINCT entry_date
			FROM entries
			WHERE season_id = ? AND person_id = ? AND deleted_at IS NULL
			ORDER BY entry_date
		`).all(seasonId, person.id) as { entry_date: string }[];
		
		if (entries.length > 1) {
			let longestGap = 0;
			let gapStart = '';
			let gapEnd = '';
			for (let i = 1; i < entries.length; i++) {
				const prev = new Date(entries[i - 1].entry_date);
				const curr = new Date(entries[i].entry_date);
				const gap = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
				if (gap > longestGap) {
					longestGap = gap;
					gapStart = entries[i - 1].entry_date;
					gapEnd = entries[i].entry_date;
				}
			}
			if (longestGap > 1) {
				bests.push({
					type: 'longest_gap',
					value: longestGap,
					details: `${longestGap} days gap (${gapStart} to ${gapEnd})`
				});
			}
		}
		
		results[person.id] = bests;
	}
	
	return results;
}

export function getConsistencyScores(seasonId: number): ConsistencyData[] {
	const people = getActivePeople();
	const season = getActiveSeason();
	if (!season) return [];
	
	const now = new Date();
	const yearStart = new Date(season.year, 0, 1);
	const totalWeeks = Math.max(1, Math.ceil((now.getTime() - yearStart.getTime()) / (7 * 24 * 60 * 60 * 1000)));
	
	const results: ConsistencyData[] = [];
	
	for (const person of people) {
		// Get weekly entry counts
		const weeklyStats = db.prepare(`
			SELECT strftime('%Y-W%W', entry_date) as week, COUNT(*) as count
			FROM entries
			WHERE season_id = ? AND person_id = ? AND deleted_at IS NULL
			GROUP BY week
		`).all(seasonId, person.id) as { week: string; count: number }[];
		
		const activeWeeks = weeklyStats.length;
		const weeks4Plus = weeklyStats.filter(w => w.count >= 4).length;
		
		// Get all entry dates for gap calculation
		const entries = db.prepare(`
			SELECT DISTINCT entry_date
			FROM entries
			WHERE season_id = ? AND person_id = ? AND deleted_at IS NULL
			ORDER BY entry_date
		`).all(seasonId, person.id) as { entry_date: string }[];
		
		let longestGap = 0;
		if (entries.length > 1) {
			for (let i = 1; i < entries.length; i++) {
				const prev = new Date(entries[i - 1].entry_date);
				const curr = new Date(entries[i].entry_date);
				const gap = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
				longestGap = Math.max(longestGap, gap);
			}
		}
		
		results.push({
			person_id: person.id,
			person_name: person.name,
			person_emoji: person.emoji,
			total_weeks: totalWeeks,
			active_weeks: activeWeeks,
			consistency_percentage: Math.round((activeWeeks / totalWeeks) * 100),
			weeks_with_4plus: weeks4Plus,
			longest_gap_days: longestGap
		});
	}
	
	return results.sort((a, b) => b.consistency_percentage - a.consistency_percentage);
}

export function getCumulativeStats(seasonId: number): { date: string; person_id: number; person_name: string; person_emoji: string; cumulative: number; expected: number }[] {
	const entries = db.prepare(`
		SELECT e.entry_date, e.person_id, p.name as person_name, p.emoji as person_emoji, COUNT(*) as count
		FROM entries e
		JOIN people p ON e.person_id = p.id
		WHERE e.season_id = ? AND e.deleted_at IS NULL
		GROUP BY e.entry_date, e.person_id
		ORDER BY e.entry_date, e.person_id
	`).all(seasonId) as { entry_date: string; person_id: number; person_name: string; person_emoji: string; count: number }[];
	
	const season = getActiveSeason();
	if (!season) return [];
	
	const goals = getGoalsForSeason(seasonId);
	const goalsByPerson = new Map<number, number>();
	for (const goal of goals) {
		const current = goalsByPerson.get(goal.person_id) || 0;
		goalsByPerson.set(goal.person_id, current + goal.target);
	}
	
	// Build cumulative data
	const cumulativeByPerson = new Map<number, { name: string; emoji: string; cumulative: number }>();
	const results: { date: string; person_id: number; person_name: string; person_emoji: string; cumulative: number; expected: number }[] = [];
	
	for (const entry of entries) {
		if (!cumulativeByPerson.has(entry.person_id)) {
			cumulativeByPerson.set(entry.person_id, { name: entry.person_name, emoji: entry.person_emoji, cumulative: 0 });
		}
		const data = cumulativeByPerson.get(entry.person_id)!;
		data.cumulative += entry.count;
		
		// Calculate expected based on day of year
		const entryDate = new Date(entry.entry_date);
		const yearStart = new Date(season.year, 0, 1);
		const dayOfYear = Math.floor((entryDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
		const yearlyGoal = goalsByPerson.get(entry.person_id) || 100;
		const expected = Math.round((dayOfYear / 365) * yearlyGoal);
		
		results.push({
			date: entry.entry_date,
			person_id: entry.person_id,
			person_name: entry.person_name,
			person_emoji: entry.person_emoji,
			cumulative: data.cumulative,
			expected
		});
	}
	
	return results;
}

export function getStreakWarnings(seasonId: number): { person_id: number; person_name: string; person_emoji: string; metric_name: string; metric_emoji: string; current_streak: number; last_entry: string; days_since: number }[] {
	const metrics = getActiveMetrics();
	const warnings: { person_id: number; person_name: string; person_emoji: string; metric_name: string; metric_emoji: string; current_streak: number; last_entry: string; days_since: number }[] = [];
	const today = new Date();
	
	for (const metric of metrics) {
		const streaks = getStreaks(seasonId, metric.id);
		for (const streak of streaks) {
			if (streak.current_daily_streak >= 2 && streak.last_entry) {
				const lastEntry = new Date(streak.last_entry);
				const daysSince = Math.floor((today.getTime() - lastEntry.getTime()) / (1000 * 60 * 60 * 24));
				// Warning if streak is at risk (last entry was today or yesterday but not today)
				if (daysSince === 1) {
					warnings.push({
						person_id: streak.person_id,
						person_name: streak.person_name,
						person_emoji: streak.person_emoji,
						metric_name: metric.name,
						metric_emoji: metric.emoji,
						current_streak: streak.current_daily_streak,
						last_entry: streak.last_entry,
						days_since: daysSince
					});
				}
			}
		}
	}
	
	return warnings;
}

// Get sports progression data by sport type (tag) over time
export interface SportProgressionData {
	tag: string;
	month: string;
	count: number;
	cumulative: number;
}

export function getSportProgression(seasonId: number): SportProgressionData[] {
	// Find the "Sporting" metric
	const sportingMetric = getActiveMetrics().find(m => m.name.toLowerCase() === 'sporting');
	if (!sportingMetric) return [];
	
	const rows = db.prepare(`
		SELECT 
			tags,
			strftime('%Y-%m', entry_date) as month,
			COUNT(*) as count
		FROM entries 
		WHERE season_id = ? 
			AND metric_id = ?
			AND deleted_at IS NULL
			AND tags IS NOT NULL
			AND tags != ''
		GROUP BY tags, strftime('%Y-%m', entry_date)
		ORDER BY tags, month
	`).all(seasonId, sportingMetric.id) as { tags: string; month: string; count: number }[];
	
	// Calculate cumulative totals per tag
	const cumulativeByTag = new Map<string, number>();
	const results: SportProgressionData[] = [];
	
	for (const row of rows) {
		const current = cumulativeByTag.get(row.tags) || 0;
		const newCumulative = current + row.count;
		cumulativeByTag.set(row.tags, newCumulative);
		
		results.push({
			tag: row.tags,
			month: row.month,
			count: row.count,
			cumulative: newCumulative
		});
	}
	
	return results;
}

// Get sport totals summary
export interface SportTotals {
	tag: string;
	emoji: string;
	total: number;
	percentage: number;
}

export function getSportTotals(seasonId: number): SportTotals[] {
	// Find the "Sporting" metric
	const sportingMetric = getActiveMetrics().find(m => m.name.toLowerCase() === 'sporting');
	if (!sportingMetric) return [];
	
	const rows = db.prepare(`
		SELECT 
			tags,
			COUNT(*) as total
		FROM entries 
		WHERE season_id = ? 
			AND metric_id = ?
			AND deleted_at IS NULL
			AND tags IS NOT NULL
			AND tags != ''
		GROUP BY tags
		ORDER BY total DESC
	`).all(seasonId, sportingMetric.id) as { tags: string; total: number }[];
	
	const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
	
	// Map sport types to emojis
	const sportEmojis: Record<string, string> = {
		'running': '🏃',
		'cycling': '🚴',
		'swimming': '🏊',
		'walking': '🚶',
		'gym': '🏋️',
		'yoga': '🧘',
		'tennis': '🎾',
		'basketball': '🏀',
		'soccer': '⚽',
		'hiking': '🥾',
		'skating': '⛸️',
		'skiing': '⛷️',
		'rowing': '🚣',
		'fitness': '💪',
		'other': '🏃'
	};
	
	return rows.map(row => ({
		tag: row.tags,
		emoji: sportEmojis[row.tags.toLowerCase()] || '🏃',
		total: row.total,
		percentage: grandTotal > 0 ? Math.round((row.total / grandTotal) * 100) : 0
	}));
}

// Get sport progression per person with cumulative data for trend lines
export interface SportProgressionByPerson {
	person_id: number;
	person_name: string;
	person_emoji: string;
	date: string;
	count: number;
	cumulative: number;
}

export function getSportProgressionByPerson(seasonId: number): SportProgressionByPerson[] {
	// Find the "Sporting" metric
	const sportingMetric = getActiveMetrics().find(m => m.name.toLowerCase() === 'sporting');
	if (!sportingMetric) return [];
	
	const rows = db.prepare(`
		SELECT 
			p.id as person_id,
			p.name as person_name,
			p.emoji as person_emoji,
			e.entry_date as date,
			COUNT(*) as count
		FROM entries e
		JOIN people p ON e.person_id = p.id
		WHERE e.season_id = ? 
			AND e.metric_id = ?
			AND e.deleted_at IS NULL
		GROUP BY p.id, e.entry_date
		ORDER BY p.id, e.entry_date
	`).all(seasonId, sportingMetric.id) as { person_id: number; person_name: string; person_emoji: string; date: string; count: number }[];
	
	// Calculate cumulative totals per person
	const cumulativeByPerson = new Map<number, number>();
	const results: SportProgressionByPerson[] = [];
	
	for (const row of rows) {
		const current = cumulativeByPerson.get(row.person_id) || 0;
		const newCumulative = current + row.count;
		cumulativeByPerson.set(row.person_id, newCumulative);
		
		results.push({
			person_id: row.person_id,
			person_name: row.person_name,
			person_emoji: row.person_emoji,
			date: row.date,
			count: row.count,
			cumulative: newCumulative
		});
	}
	
	return results;
}

// Get sport stats summary per person
export interface SportStatsByPerson {
	person_id: number;
	person_name: string;
	person_emoji: string;
	total: number;
	first_entry: string;
	last_entry: string;
	days_active: number;
}

export function getSportStatsByPerson(seasonId: number): SportStatsByPerson[] {
	// Find the "Sporting" metric
	const sportingMetric = getActiveMetrics().find(m => m.name.toLowerCase() === 'sporting');
	if (!sportingMetric) return [];
	
	const rows = db.prepare(`
		SELECT 
			p.id as person_id,
			p.name as person_name,
			p.emoji as person_emoji,
			COUNT(*) as total,
			MIN(e.entry_date) as first_entry,
			MAX(e.entry_date) as last_entry,
			COUNT(DISTINCT e.entry_date) as days_active
		FROM entries e
		JOIN people p ON e.person_id = p.id
		WHERE e.season_id = ? 
			AND e.metric_id = ?
			AND e.deleted_at IS NULL
		GROUP BY p.id
		ORDER BY total DESC
	`).all(seasonId, sportingMetric.id) as SportStatsByPerson[];
	
	return rows;
}


