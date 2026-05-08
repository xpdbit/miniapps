# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY ftg-server/package.json ftg-server/package-lock.json ./

# Install ALL dependencies (including devDependencies)
RUN npm ci

# Copy Prisma schema (unified at root prisma/)
COPY prisma/ ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY ftg-server/tsconfig.json ./
COPY ftg-server/src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# ---- Production Stage ----
FROM node:20-slim AS production

WORKDIR /app

# Create non-root user for security
RUN groupadd --system --gid 1001 appuser && \
    useradd --system --uid 1001 --gid appuser appuser

# Install wait utility for container orchestration
RUN apt-get update && apt-get install -y --no-install-recommends \
    netcat-traditional libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
# Copy Prisma schema (needed for prisma db push during deployment)
COPY --from=builder /app/prisma ./prisma

# Expose server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD node -e "require('http').get('http://localhost:3000/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Switch to non-root user
USER appuser

# Start the server
CMD ["node", "dist/app.js"]
