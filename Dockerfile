FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN echo "📦 Installing dependencies..." && npm ci && echo "✅ Dependencies installed"

# Copy source and build (data/ is excluded via .dockerignore)
COPY . .

# Generate SvelteKit files first, then build
RUN echo "🔧 Running svelte-kit sync..." && \
    npx svelte-kit sync && \
    echo "✅ Sync complete" && \
    echo "🏗️  Building application..." && \
    npm run build && \
    echo "✅ Build complete"

# Verify build output exists
RUN echo "📁 Checking build output..." && \
    ls -la /app/build && \
    echo "✅ Build output verified"

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Copy built application
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Verify files were copied
RUN echo "📁 Verifying production files..." && \
    ls -la /app/build && \
    echo "✅ Production files verified"

# Create data directory for SQLite (will be mounted as volume)
# This directory should be empty in the image - data comes from volume
RUN mkdir -p /app/data && chown -R node:node /app/data

# Switch to non-root user for security
USER node

# Set environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DB_PATH=/app/data/resolution-recap.db

# Expose port
EXPOSE 3000

# Health check - uses dedicated /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 -O /dev/null http://localhost:3000/health || exit 1

# Run the application
CMD ["node", "build"]
