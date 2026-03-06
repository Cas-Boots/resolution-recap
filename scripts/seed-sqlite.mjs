import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dbPath = process.env.DB_PATH || './data/local-test.db';
const sqlPath = path.resolve('./scripts/seed-sqlite.sql');

if (!fs.existsSync(sqlPath)) {
	console.error(`Seed SQL not found at ${sqlPath}`);
	process.exit(1);
}

const database = new Database(dbPath);

try {
	const hasSeasonsTable = database
		.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'seasons' LIMIT 1")
		.get();

	if (!hasSeasonsTable) {
		throw new Error(
			`Database schema not found in ${dbPath}. Start the app once (docker compose local up) so migrations can run, then seed again.`
		);
	}

	const seedSql = fs.readFileSync(sqlPath, 'utf8');
	database.exec(seedSql);

	const trackerPin = process.env.TRACKER_PIN;
	const adminPin = process.env.ADMIN_PIN;

	if (trackerPin) {
		database
			.prepare(
				`INSERT INTO settings (key, value, updated_at)
				 VALUES ('tracker_pin', ?, datetime('now'))
				 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
			)
			.run(trackerPin);
	}

	if (adminPin) {
		database
			.prepare(
				`INSERT INTO settings (key, value, updated_at)
				 VALUES ('admin_pin', ?, datetime('now'))
				 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
			)
			.run(adminPin);
	}

	console.log(`✅ Local test data seeded into ${dbPath}`);
} catch (error) {
	console.error('❌ Failed to seed local test data:', error);
	process.exitCode = 1;
} finally {
	database.close();
}
