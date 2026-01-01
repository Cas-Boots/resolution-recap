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

### Deployment with Dokploy

1. Create a new Application in Dokploy
2. Connect to your GitHub repository
3. Set build method to **Dockerfile** or **Railpacks** (auto-detect)
4. Add environment variables:
   - `TRACKER_PIN` - PIN for the tracker role
   - `ADMIN_PIN` - PIN for the admin role
   - `BACKUP_TOKEN` - Secret token for automated backups
   - `DB_PATH` - `/app/data/resolution-recap.db`
5. Add a **volume mount**:
   - Host path or volume: `resolution-recap-data`
   - Container path: `/app/data`
6. Configure domain: `recap.avs-api.nl` with base path `/snapvrienden-r3c4p`
7. Deploy!

### GitHub Actions Backup

1. Go to your repository Settings → Secrets and variables → Actions
2. Add repository secrets:
   - `APP_URL` - Your deployed app URL (e.g., `https://recap.avs-api.nl/snapvrienden-r3c4p`)
   - `BACKUP_TOKEN` - Same token as in Dokploy env vars
3. The workflow runs daily at midnight UTC and commits backups to the `backups/` folder

## Tech Stack

- **Frontend**: SvelteKit 5 + TailwindCSS 4
- **Backend**: SvelteKit API routes
- **Database**: SQLite with better-sqlite3
- **Deployment**: Docker / Dokploy with Railpacks

## Pre-seeded Data

On first run, the app seeds:
- **Season**: 2026
- **People**: Cas, Joris, Eva, Rik, Liz, Bastiaan
- **Metrics**: Sporting, Cakes Eaten

## Security Notes

- The app uses an obscure URL path (`/snapvrienden-r3c4p/`) to avoid random access
- `robots.txt` blocks crawlers with `Disallow: /`
- `<meta name="robots" content="noindex, nofollow">` prevents indexing
- Simple PIN authentication (not meant for sensitive data)

## License

Private project for friend group use.
