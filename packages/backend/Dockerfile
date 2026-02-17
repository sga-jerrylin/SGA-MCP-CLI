FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY packages/core ./packages/core
COPY packages/backend ./packages/backend

RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm --filter @mcp-claw/shared build || true
RUN pnpm --filter @mcp-claw/backend build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist

EXPOSE 8080
CMD ["node", "dist/main.js"]
