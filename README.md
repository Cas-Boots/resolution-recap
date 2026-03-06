# Resolution Recap 🎯

A mobile-friendly web app to track friend group metrics (sporting, cakes eaten, etc.) throughout the year for the annual New Year's quiz.

## Features

- 📊 **Dashboard** - View current season totals per person/metric
- ➕ **Quick Add** - Log entries with adjustable dates (for catching up on old snaps)
- 📈 **Stats** - Filter by date range, leaderboard view for quiz night
- ⚙️ **Settings** - Add/edit people and metrics
- 📅 **Seasons** - Admin can create new seasons for future years
- 📝 **Entry Management** - Admin can bulk edit/delete entries
- 💾 **Automatic Backups** - Daily GitHub commits to prevent data loss

## Roles

- **Tracker PIN** - Full access to dashboard, add entries, stats, and settings
- **Admin PIN** - Manage seasons, bulk edit/delete entries (without seeing stats or notes), export data

## Setup

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment file and set your PINs:
   ```bash
   cp .env.example .env
   # Edit .env with your preferred PINs
   ```
4. Run development server:
   ```bash
   npm run dev
   ```

### Local Docker Testing (with Dummy Data)

Use this when you want to test in Docker with hot-reload and a rich local dataset.

Quick start (one command):

```bash
npm run docker:local:setup
```

This starts Docker in detached mode, waits for the app to respond, then seeds local dummy data.
Seeding for this command runs inside the container to avoid host file permission issues.

Manual flow:

1. Start the local Docker stack:
   ```bash
   npm run docker:local:up
   ```
2. Seed deterministic local test data:
   ```bash
   npm run seed:local
   ```
3. Open the app at `http://localhost:5173`

Default local testing PINs:
- Tracker: `1111`
- Admin: `9999`

Optional reset (fresh local test DB):
```bash
npm run db:local:reset
```

Fast reset + reseed (without rebuild):
```bash
npm run docker:local:reseed
```
This reseed flow also runs seeding inside the container.

Notes:
- Local Docker uses `./data/local-test.db` so production data paths are not touched.
- Keep only one writer against this SQLite DB at a time.

### Deployment with Dokploy

1. Create a new Application in Dokploy
2. Connect to your GitHub repository
3. Set build method to **Docker Compose**
4. Add environment variables:
   - `TRACKER_PIN` - PIN for the tracker role
   - `ADMIN_PIN` - PIN for the admin role
   - `BACKUP_TOKEN` - Secret token for automated backups
5. Add a **volume mount** (or let Docker Compose create it):
   - Volume name: `resolution-recap-data`
   - Container path: `/app/data`
6. Configure your subdomain in Dokploy's Domains section
7. Deploy!

### GitHub Actions Backup

1. Go to your repository Settings → Secrets and variables → Actions
2. Add repository secrets:
   - `APP_URL` - Your deployed app URL (e.g., `https://recap.yourdomain.com`)
   - `BACKUP_TOKEN` - Same token as in Dokploy env vars
3. The workflow runs daily at midnight UTC and commits backups to the `backups/` folder

## Tech Stack

- **Frontend**: SvelteKit 5 + TailwindCSS 4
- **Backend**: SvelteKit API routes
- **Database**: SQLite with better-sqlite3
- **Deployment**: Docker Compose / Dokploy

## Pre-seeded Data

On first run, the app seeds:
- **Season**: 2026
- **People**: Cas, Joris, Eva, Rik, Liz, Bastiaan
- **Metrics**: Sporting, Cakes Eaten

## Security Notes

- PIN authentication protects all sensitive routes
- `robots.txt` blocks crawlers with `Disallow: /`
- `<meta name="robots" content="noindex, nofollow">` prevents indexing
- Use a dedicated subdomain for additional obscurity

## License

Private project for friend group use.
