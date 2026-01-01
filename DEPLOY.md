# Dokploy Deployment Guide

## Prerequisites
- GitHub repository with your code
- Dokploy instance running
- Domain configured (optional)

## Deployment Steps

### 1. Push to GitHub
Make sure your code is pushed to a GitHub repository:
```bash
git add .
git commit -m "Add Nixpacks configuration for deployment"
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
| **Build Type** | Nixpacks |
| **Build Path** | `/` (root) |
| **Port** | `3000` |

### 4. Environment Variables

Add these environment variables in Dokploy:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Production mode |
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind to all interfaces |
| `DB_PATH` | `/app/data/resolution-recap.db` | SQLite database path |

### 5. Persistent Storage (Important for SQLite!)

Since you're using SQLite with `better-sqlite3`, you need persistent storage:

1. Go to **Advanced** → **Volumes**
2. Add a volume mount:
   - **Source**: `resolution-recap-data` (or any name)
   - **Target**: `/app/data`

This ensures your database persists across deployments.

### 6. Domain Configuration (Optional)

1. Go to **Domains** tab
2. Add your domain or use the auto-generated one
3. Enable HTTPS if using a custom domain

### 7. Deploy

Click **"Deploy"** to start the build and deployment process.

## Automatic Deployments

To enable auto-deploy on push:

1. Go to application settings
2. Enable **"Auto Deploy"**
3. Dokploy will automatically redeploy when you push to the configured branch

## Troubleshooting

### Build Fails with native module errors
The `nixpacks.toml` includes `python3`, `gcc`, and `gnumake` which are required for building `better-sqlite3`. If issues persist, you can use the Docker build instead:

1. Change **Build Type** to **Dockerfile**
2. The existing `Dockerfile` will be used

### Database not persisting
Make sure you've configured the volume mount for `/app/data`.

### Port issues
Ensure the `PORT` environment variable matches what's configured in Dokploy's port settings.

## Files for Deployment

- `nixpacks.toml` - Nixpacks build configuration
- `Dockerfile` - Alternative Docker build (backup option)
- `package.json` - Node.js configuration with build scripts
- `svelte.config.js` - SvelteKit with Node adapter
