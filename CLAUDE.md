# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Resolution Recap is a mobile-first SvelteKit 5 app for tracking a friend group's yearly metrics (sports, cakes eaten, etc.) for an annual New Year's quiz. It uses SQLite for persistence, PIN-based role auth, and supports offline entry via a service worker + IndexedDB queue.

## Commands

```bash
npm run dev                  # Start Vite dev server
npm run build                # Production build
npm run check                # svelte-check + TypeScript (run this to catch type errors)
npm run check:watch          # Same, in watch mode

# Docker local dev (recommended — matches prod Node adapter)
npm run docker:local:up      # Build and start container at localhost:5173
npm run docker:local:down    # Stop
npm run docker:local:setup   # Up + wait for health + seed test data
npm run docker:local:reseed  # Full reset: down, wipe DB, up, seed

# Database
npm run db:local:reset       # Delete local SQLite files (data/local-test.db*)
npm run seed:local           # Seed test data directly (needs DB_PATH set)
```

There is no test framework and no linter configured.

## Environment Variables

Copy `.env.example`. Required variables:

| Variable | Purpose |
|---|---|
| `DB_PATH` | Absolute path to SQLite file |
| `TRACKER_PIN` | PIN for tracker role (full app access) |
| `ADMIN_PIN` | PIN for admin role (manage data, no stats/notes) |
| `AUTH_SECRET` | Min 32-char secret for HMAC cookie signing |
| `BACKUP_TOKEN` | Bearer token for `/api/backup/*` endpoints |
| `ORIGIN` | Full origin URL (required behind reverse proxy) |
| `DOMAIN` | Cookie domain |

## Architecture

### Request Flow

1. `src/hooks.server.ts` — Runs on every request: initialises the DB (lazy, once), logs requests, extracts the signed `auth_role` cookie into `event.locals.role`.
2. `src/routes/+layout.server.ts` — Passes `role` to the frontend so pages can gate UI.
3. `src/routes/+layout.svelte` — Shows `PinOverlay` when unauthenticated; handles auth routing.
4. Individual `+page.server.ts` files call `requireRole()` then query the DB directly.

### Authentication

`src/lib/server/auth.ts` implements PIN-based role auth:
- Two roles: `tracker` (dashboard + add entries) and `admin` (bulk edit/delete, no sensitive stats).
- `POST /api/auth` validates a PIN against env vars, calls `signRole()` to produce an HMAC-SHA256 signed token, and sets an `auth_role` httpOnly cookie (30-day expiry).
- Every protected route calls `requireRole(event, 'tracker')` or `requireRole(event, 'admin')`, which verifies the cookie signature via constant-time comparison.
- In-memory rate limiter: 5 failed attempts per IP per 15 minutes.

### Database Layer

All DB logic lives in `src/lib/server/db.ts` (~3100 lines). It exports typed query functions — no ORM, raw `better-sqlite3` prepared statements. Key patterns:
- `getDb()` returns the singleton connection; call this inside server functions, never at module load time (build-time safety).
- WAL mode + foreign keys enabled on first connection.
- `initializeDatabase()` runs schema migrations and auto-seeds if the DB is empty.
- Schema migrations are additive `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements, safe to re-run.

### API Routes

REST endpoints under `src/routes/api/`. All mutating operations are POST (not REST-idiomatic PUT/PATCH — this is intentional). Backup endpoints (`/api/backup/db`, `/api/export`) use Bearer token auth via `src/lib/server/backup-auth.ts`, separate from the PIN cookie system.

### Offline Queue

`src/lib/stores/offlineQueue.ts` — IndexedDB-backed queue for entries created while offline. The service worker (`src/service-worker.ts`) intercepts fetch; on reconnect the queue syncs with up to 5 retries per entry.

### Sports & Metrics

`src/lib/sports.ts` defines the canonical sport type list, emoji map, grouping (cardio/strength/flexibility/team/other), and aliases used for deduplication. The `Sporting` metric uses an entry's `tags` column to store the sport type. `src/lib/ranking.ts` and `src/lib/leveling.ts` handle leaderboard scoring and achievement definitions.

### i18n

Two locales: `en` and `nl`. Translation keys are defined in `src/lib/i18n.ts`. The active locale is a Svelte store in `src/lib/stores/locale.ts`; components subscribe to it directly.

## Deployment

Production runs via Docker + Dokploy. The `docker-compose.yml` connects to the external `dokploy-network` and mounts a named volume `resolution-recap-data` at `/app/data`. The `Dockerfile` is a multi-stage build; the final image is Node 22 Alpine.

Daily backups run via `.github/workflows/backup.yml` (midnight UTC): hits `/api/export` (JSON) and `/api/backup/db` (gzipped SQLite), commits to `backups/`. `scripts/verify-backup.py` and `check-backup.py` validate integrity.

## Svelte 5 Notes

This project uses Svelte 5 runes (`$state`, `$derived`, `$effect`) throughout. The one suppressed warning (`state_referenced_locally`) in `svelte.config.js` is intentional for specific component patterns — don't remove it.
