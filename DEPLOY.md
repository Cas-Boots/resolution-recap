# Dokploy Deployment Guide

## ⚠️ CRITICAL: Data Persistence

**The SQLite database MUST be stored on a persistent volume!** Without proper volume configuration, your data will be lost on every rebuild/redeploy.

## Prerequisites
- GitHub repository with your code
- Dokploy instance running
- Subdomain configured for the app

## Deployment Steps

### 1. Push to GitHub
Make sure your code is pushed to a GitHub repository:
```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

### 2. Create Application in Dokploy

1. Go to your Dokploy dashboard
2. Click **"Create Project"** or select an existing project
3. Click **"Create Service"** → **"Application"**
4. Select **"GitHub"** as the source
5. Connect your GitHub account if not already connected
6. Select your repository: `resolution-recap`
7. Choose the branch: `main`

### 3. Configure Build Settings

In the application settings:

| Setting | Value |
|---------|-------|
| **Build Type** | Docker Compose |
| **Build Path** | `/` (root) |
| **Port** | `3000` |

### 4. ⚠️ IMPORTANT: Persistent Storage (DO THIS FIRST!)

**Before deploying**, configure persistent storage to prevent data loss:

The `docker-compose.yml` already includes volume configuration:
```yaml
volumes:
  - resolution-recap-data:/app/data

volumes:
  resolution-recap-data:
    name: resolution-recap-data
```

Docker will automatically create the named volume on first deploy.

**For manual Docker runs**:
```bash
docker run -v resolution-recap-data:/app/data -p 3000:3000 your-image
```

### 5. Environment Variables

Add these environment variables in Dokploy:

| Variable | Value | Description |
|----------|-------|-------------|
| `TRACKER_PIN` | `your-pin` | PIN for tracker access |
| `ADMIN_PIN` | `your-admin-pin` | PIN for admin access |
| `BACKUP_TOKEN` | `your-backup-token` | Token for automated backups |

The following are already set in the Dockerfile/docker-compose:
- `NODE_ENV=production`
- `PORT=3000`
- `HOST=0.0.0.0`
- `DB_PATH=/app/data/resolution-recap.db`

### 6. Domain Configuration

1. Go to **Domains** tab in Dokploy
2. Add your subdomain (e.g., `recap.yourdomain.com`)
3. Enable HTTPS (Dokploy handles Let's Encrypt automatically)
4. The app will be accessible at the root of your subdomain

### 7. Deploy

Click **"Deploy"** to start the build and deployment process.

## Backup and Restore

### Creating Backups

**From inside the container:**
```bash
docker exec -it <container_id> sqlite3 /app/data/resolution-recap.db ".backup '/app/data/backup.db'"
docker cp <container_id>:/app/data/backup.db ./backup.db
```

**Using the backup script (local development):**
```bash
chmod +x scripts/backup.sh
./scripts/backup.sh
```

### Restoring from Backup

```bash
chmod +x scripts/restore.sh
./scripts/restore.sh backups/resolution-recap_20260102_120000.db.gz
```

### Automatic Backups (Recommended)

Set up a cron job or scheduled task to backup regularly:
```bash
# Add to crontab (daily at 3 AM)
0 3 * * * docker exec <container_id> sqlite3 /app/data/resolution-recap.db ".backup '/app/data/daily-backup.db'"
```

## Automatic Deployments

To enable auto-deploy on push:

1. Go to application settings
2. Enable **"Auto Deploy"**
3. Dokploy will automatically redeploy when you push to the configured branch

## Troubleshooting

### Database not persisting / Data lost after rebuild
This is the **most common issue**. Verify:
1. Volume is properly configured in Dokploy
2. Volume mount target is exactly `/app/data`
3. Check volume exists: `docker volume ls | grep resolution-recap`
4. Inspect the volume: `docker volume inspect resolution-recap-data`

### Build Fails with native module errors
The `Dockerfile` includes proper build configuration for `better-sqlite3`. If issues persist:
- Check the build logs for specific errors
- Ensure `npm ci` runs successfully

### Port issues
Ensure the `PORT` environment variable matches what's configured in Dokploy's port settings.

### Database locked errors
The database uses WAL mode for better concurrent access. If you see lock errors:
- Ensure only one container is running
- Check for zombie processes accessing the database

## Files for Deployment

- `.dockerignore` - Excludes data/ from builds (prevents data loss!)
- `Dockerfile` - Docker build configuration
- `docker-compose.yml` - Docker Compose with volume and network config
- `package.json` - Node.js configuration with build scripts
- `svelte.config.js` - SvelteKit with Node adapter
- `scripts/backup.sh` - Database backup script
- `scripts/restore.sh` - Database restore script
