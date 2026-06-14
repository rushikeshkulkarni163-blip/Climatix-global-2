FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ── Production image ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 climactix \
  && adduser --system --uid 1001 climactix

WORKDIR /app

COPY --from=builder --chown=climactix:climactix /app/dist ./dist
COPY --from=builder --chown=climactix:climactix /app/node_modules ./node_modules
COPY --from=builder --chown=climactix:climactix /app/package.json ./package.json

USER climactix

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3100/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
