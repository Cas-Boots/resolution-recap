PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

DELETE FROM entry_audit;
DELETE FROM goals;
DELETE FROM achievements;
DELETE FROM countries_visited;
DELETE FROM entries;
DELETE FROM settings;
DELETE FROM metrics;
DELETE FROM people;
DELETE FROM seasons;

DELETE FROM sqlite_sequence
WHERE name IN ('entry_audit', 'goals', 'achievements', 'countries_visited', 'entries', 'metrics', 'people', 'seasons');

INSERT INTO seasons (id, year, name, is_active, created_at)
VALUES
  (1, 2026, 'Season 2026', 1, datetime('now')),
  (2, 2025, 'Season 2025', 0, datetime('now'));

INSERT INTO people (id, name, emoji, is_active, created_at)
VALUES
  (1, 'Cas', '🎯', 1, datetime('now')),
  (2, 'Joris', '🦁', 1, datetime('now')),
  (3, 'Eva', '🌸', 1, datetime('now')),
  (4, 'Rik', '🎸', 1, datetime('now')),
  (5, 'Liz', '✨', 1, datetime('now')),
  (6, 'Bastiaan', '🚀', 1, datetime('now'));

INSERT INTO metrics (id, name, name_nl, emoji, is_active, created_at)
VALUES
  (1, 'Sporting', 'Gesport', '🏃', 1, datetime('now')),
  (2, 'Cakes Eaten', 'Taart gegeten', '🎂', 1, datetime('now'));

INSERT INTO settings (key, value, updated_at)
VALUES
  ('tracker_pin', '1111', datetime('now')),
  ('admin_pin', '9999', datetime('now')),
  ('locale', 'en', datetime('now'));

INSERT INTO entries (id, season_id, person_id, metric_id, entry_date, notes, tags, deleted_at, created_at)
VALUES
  (1, 1, 1, 1, '2026-01-03', 'Morning run', '["running"]', NULL, datetime('now')),
  (2, 1, 2, 1, '2026-01-05', 'Gym session', '["gym"]', NULL, datetime('now')),
  (3, 1, 3, 2, '2026-01-06', 'Birthday cake', NULL, NULL, datetime('now')),
  (4, 1, 4, 1, '2026-01-07', 'Cycling with friends', '["cycling"]', NULL, datetime('now')),
  (5, 1, 5, 2, '2026-01-08', 'Pastry at brunch', NULL, NULL, datetime('now')),
  (6, 1, 6, 1, '2026-01-09', 'Padel match', '["padel"]', NULL, datetime('now')),
  (7, 1, 1, 2, '2026-01-11', 'Cheesecake slice', NULL, NULL, datetime('now')),
  (8, 1, 2, 1, '2026-01-12', 'Indoor rowing', '["rowing"]', NULL, datetime('now')),
  (9, 1, 3, 1, '2026-01-13', 'Pilates class', '["pilates"]', NULL, datetime('now')),
  (10, 1, 4, 2, '2026-01-15', 'Office cake day', NULL, NULL, datetime('now')),
  (11, 1, 5, 1, '2026-01-16', 'Yoga session', '["yoga"]', NULL, datetime('now')),
  (12, 1, 6, 2, '2026-01-17', 'Chocolate tart', NULL, NULL, datetime('now')),
  (13, 1, 1, 1, '2026-02-01', 'Long trail run', '["running","trail"]', NULL, datetime('now')),
  (14, 1, 2, 2, '2026-02-03', 'Cupcake tasting', NULL, NULL, datetime('now')),
  (15, 1, 3, 1, '2026-02-04', 'Evening walk', '["walking"]', NULL, datetime('now')),
  (16, 1, 4, 1, '2026-02-05', 'Swimming laps', '["swimming"]', NULL, datetime('now')),
  (17, 1, 5, 2, '2026-02-07', 'Valentine preview cake', NULL, NULL, datetime('now')),
  (18, 1, 6, 1, '2026-02-08', 'Boxing training', '["boxing"]', NULL, datetime('now')),
  (19, 1, 1, 1, '2026-03-02', 'Tempo run', '["running"]', NULL, datetime('now')),
  (20, 1, 2, 1, '2026-03-04', 'Football match', '["football"]', NULL, datetime('now')),
  (21, 1, 3, 2, '2026-03-06', 'Lemon pie', NULL, NULL, datetime('now')),
  (22, 1, 4, 1, '2026-03-09', 'Bouldering session', '["bouldering"]', NULL, datetime('now')),
  (23, 1, 5, 1, '2026-03-11', 'Hiking in dunes', '["hiking"]', NULL, datetime('now')),
  (24, 1, 6, 2, '2026-03-13', 'Cheesecake bites', NULL, NULL, datetime('now')),
  (25, 1, 1, 2, '2026-04-02', 'Birthday leftovers', NULL, NULL, datetime('now')),
  (26, 1, 2, 1, '2026-04-04', 'Padel ladder match', '["padel"]', NULL, datetime('now')),
  (27, 1, 3, 1, '2026-04-07', 'Gym class', '["gym"]', NULL, datetime('now')),
  (28, 1, 4, 2, '2026-04-09', 'Carrot cake', NULL, NULL, datetime('now')),
  (29, 1, 5, 1, '2026-04-12', 'Pilates reformer', '["pilates"]', NULL, datetime('now')),
  (30, 1, 6, 1, '2026-04-14', 'Cycling commute', '["cycling"]', NULL, datetime('now')),
  (31, 1, 1, 1, '2026-05-03', 'Hyrox prep', '["hyrox"]', NULL, datetime('now')),
  (32, 1, 2, 2, '2026-05-04', 'Apple tart', NULL, NULL, datetime('now')),
  (33, 1, 3, 1, '2026-05-06', 'Dance workout', '["dance"]', NULL, datetime('now')),
  (34, 1, 4, 1, '2026-05-09', 'Tennis rally', '["tennis"]', NULL, datetime('now')),
  (35, 1, 5, 2, '2026-05-10', 'Bakery hopping', NULL, NULL, datetime('now')),
  (36, 1, 6, 1, '2026-05-12', 'Skating drills', '["skating"]', NULL, datetime('now')),
  (37, 1, 1, 1, '2026-06-02', 'Swimming intervals', '["swimming"]', NULL, datetime('now')),
  (38, 1, 2, 1, '2026-06-03', 'Morning run', '["running"]', NULL, datetime('now')),
  (39, 1, 3, 2, '2026-06-05', 'Strawberry shortcake', NULL, NULL, datetime('now')),
  (40, 1, 4, 1, '2026-06-07', 'Weekend hike', '["hiking"]', NULL, datetime('now')),
  (41, 1, 5, 1, '2026-06-09', 'Yoga flow', '["yoga"]', NULL, datetime('now')),
  (42, 1, 6, 2, '2026-06-10', 'Donut day', NULL, NULL, datetime('now')),
  (43, 1, 2, 1, '2026-07-01', 'Rowing machine', '["rowing"]', NULL, datetime('now')),
  (44, 1, 4, 2, '2026-07-04', 'Festival waffle', NULL, NULL, datetime('now')),
  (45, 2, 1, 1, '2025-03-05', 'Spring run', '["running"]', NULL, datetime('now')),
  (46, 2, 2, 2, '2025-03-07', 'Cheesecake', NULL, NULL, datetime('now')),
  (47, 2, 3, 1, '2025-03-09', 'Gym day', '["gym"]', NULL, datetime('now')),
  (48, 2, 4, 1, '2025-03-11', 'Cycling route', '["cycling"]', NULL, datetime('now')),
  (49, 2, 5, 2, '2025-03-14', 'Lava cake', NULL, NULL, datetime('now')),
  (50, 2, 6, 1, '2025-03-16', 'Padel doubles', '["padel"]', NULL, datetime('now')),
  (51, 2, 1, 2, '2025-04-01', 'Birthday cupcake', NULL, NULL, datetime('now')),
  (52, 2, 3, 1, '2025-04-06', 'Pilates', '["pilates"]', NULL, datetime('now'));

INSERT INTO entry_audit (id, entry_id, action, old_values, new_values, performed_by, performed_at)
VALUES
  (1, 1, 'create', NULL, '{"season_id":1,"person_id":1,"metric_id":1}', 'tracker', datetime('now')),
  (2, 2, 'create', NULL, '{"season_id":1,"person_id":2,"metric_id":1}', 'tracker', datetime('now')),
  (3, 3, 'create', NULL, '{"season_id":1,"person_id":3,"metric_id":2}', 'admin', datetime('now')),
  (4, 13, 'create', NULL, '{"season_id":1,"person_id":1,"metric_id":1}', 'tracker', datetime('now')),
  (5, 19, 'create', NULL, '{"season_id":1,"person_id":1,"metric_id":1}', 'tracker', datetime('now')),
  (6, 22, 'create', NULL, '{"season_id":1,"person_id":4,"metric_id":1}', 'admin', datetime('now')),
  (7, 27, 'create', NULL, '{"season_id":1,"person_id":3,"metric_id":1}', 'tracker', datetime('now')),
  (8, 31, 'create', NULL, '{"season_id":1,"person_id":1,"metric_id":1}', 'tracker', datetime('now')),
  (9, 34, 'create', NULL, '{"season_id":1,"person_id":4,"metric_id":1}', 'tracker', datetime('now')),
  (10, 38, 'create', NULL, '{"season_id":1,"person_id":2,"metric_id":1}', 'tracker', datetime('now')),
  (11, 44, 'create', NULL, '{"season_id":1,"person_id":4,"metric_id":2}', 'admin', datetime('now')),
  (12, 45, 'create', NULL, '{"season_id":2,"person_id":1,"metric_id":1}', 'admin', datetime('now')),
  (13, 46, 'create', NULL, '{"season_id":2,"person_id":2,"metric_id":2}', 'admin', datetime('now')),
  (14, 47, 'create', NULL, '{"season_id":2,"person_id":3,"metric_id":1}', 'admin', datetime('now')),
  (15, 48, 'update', '{"tags":"[\"cycling\"]"}', '{"tags":"[\"cycling\",\"endurance\"]"}', 'admin', datetime('now')),
  (16, 50, 'delete', '{"deleted_at":null}', '{"deleted_at":"2025-03-20"}', 'admin', datetime('now')),
  (17, 50, 'undelete', '{"deleted_at":"2025-03-20"}', '{"deleted_at":null}', 'admin', datetime('now'));

INSERT INTO goals (id, season_id, person_id, metric_id, target, created_at, updated_at)
VALUES
  (1, 1, 1, 1, 40, datetime('now'), datetime('now')),
  (2, 1, 1, 2, 14, datetime('now'), datetime('now')),
  (3, 1, 2, 1, 35, datetime('now'), datetime('now')),
  (4, 1, 2, 2, 16, datetime('now'), datetime('now')),
  (5, 1, 3, 1, 30, datetime('now'), datetime('now')),
  (6, 1, 3, 2, 20, datetime('now'), datetime('now')),
  (7, 1, 4, 1, 30, datetime('now'), datetime('now')),
  (8, 1, 4, 2, 12, datetime('now'), datetime('now')),
  (9, 1, 5, 1, 28, datetime('now'), datetime('now')),
  (10, 1, 5, 2, 12, datetime('now'), datetime('now')),
  (11, 1, 6, 1, 28, datetime('now'), datetime('now')),
  (12, 1, 6, 2, 10, datetime('now'), datetime('now')),
  (13, 2, 1, 1, 24, datetime('now'), datetime('now')),
  (14, 2, 2, 2, 10, datetime('now'), datetime('now')),
  (15, 2, 3, 1, 20, datetime('now'), datetime('now')),
  (16, 2, 6, 1, 18, datetime('now'), datetime('now'));

INSERT INTO achievements (id, season_id, person_id, achievement_key, unlocked_at)
VALUES
  (1, 1, 1, 'first_entry', datetime('now')),
  (2, 1, 1, 'entries_10', datetime('now')),
  (3, 1, 2, 'first_entry', datetime('now')),
  (4, 1, 2, 'weekly_4', datetime('now')),
  (5, 1, 3, 'weekend_warrior', datetime('now')),
  (6, 1, 3, 'first_entry', datetime('now')),
  (7, 1, 4, 'first_entry', datetime('now')),
  (8, 1, 4, 'entries_10', datetime('now')),
  (9, 1, 5, 'all_rounder', datetime('now')),
  (10, 1, 5, 'first_entry', datetime('now')),
  (11, 1, 6, 'first_entry', datetime('now')),
  (12, 1, 6, 'streak_7d', datetime('now')),
  (13, 1, 1, 'streak_7d', datetime('now')),
  (14, 1, 2, 'entries_25', datetime('now')),
  (15, 1, 4, 'goal_crusher', datetime('now')),
  (16, 2, 1, 'first_entry', datetime('now')),
  (17, 2, 2, 'first_entry', datetime('now')),
  (18, 2, 3, 'first_entry', datetime('now'));

INSERT INTO countries_visited (id, season_id, person_id, country_code, country_name, visited_at)
VALUES
  (1, 1, 1, 'NL', 'Netherlands', datetime('now')),
  (2, 1, 1, 'BE', 'Belgium', datetime('now')),
  (3, 1, 1, 'FR', 'France', datetime('now')),
  (4, 1, 1, 'IT', 'Italy', datetime('now')),
  (5, 1, 2, 'DE', 'Germany', datetime('now')),
  (6, 1, 2, 'AT', 'Austria', datetime('now')),
  (7, 1, 2, 'CH', 'Switzerland', datetime('now')),
  (8, 1, 2, 'CZ', 'Czech Republic', datetime('now')),
  (9, 1, 3, 'FR', 'France', datetime('now')),
  (10, 1, 3, 'ES', 'Spain', datetime('now')),
  (11, 1, 3, 'PT', 'Portugal', datetime('now')),
  (12, 1, 3, 'MA', 'Morocco', datetime('now')),
  (13, 1, 4, 'GB', 'United Kingdom', datetime('now')),
  (14, 1, 4, 'IE', 'Ireland', datetime('now')),
  (15, 1, 4, 'IS', 'Iceland', datetime('now')),
  (16, 1, 4, 'NO', 'Norway', datetime('now')),
  (17, 1, 5, 'ES', 'Spain', datetime('now')),
  (18, 1, 5, 'IT', 'Italy', datetime('now')),
  (19, 1, 5, 'GR', 'Greece', datetime('now')),
  (20, 1, 5, 'HR', 'Croatia', datetime('now')),
  (21, 1, 6, 'PT', 'Portugal', datetime('now')),
  (22, 1, 6, 'US', 'United States', datetime('now')),
  (23, 1, 6, 'CA', 'Canada', datetime('now')),
  (24, 1, 6, 'JP', 'Japan', datetime('now')),
  (25, 2, 1, 'NL', 'Netherlands', datetime('now')),
  (26, 2, 2, 'BE', 'Belgium', datetime('now')),
  (27, 2, 3, 'DE', 'Germany', datetime('now')),
  (28, 2, 4, 'FR', 'France', datetime('now')),
  (29, 2, 5, 'ES', 'Spain', datetime('now')),
  (30, 2, 6, 'PT', 'Portugal', datetime('now'));

COMMIT;

PRAGMA foreign_keys = ON;
