# Build stage — install ALL dependencies (including tsx for running TS in prod)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma/ ./prisma/
RUN npx prisma generate
COPY tsconfig.json ./
COPY src/ ./src/

# Production stage — run TypeScript directly with tsx (no tsc compilation needed)
FROM node:20-slim AS runner
WORKDIR /app
RUN groupadd --system --gid 1001 appuser && \
    useradd --system --uid 1001 --gid appuser appuser
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./
ENV NODE_OPTIONS="--max-old-space-size=256"
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD node -e "require('http').get('http://localhost:3002/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"
USER appuser
CMD ["npx", "tsx", "src/index.ts"]
