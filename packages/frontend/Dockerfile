FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend

RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm --filter @mcp-claw/shared build || true
RUN pnpm --filter @mcp-claw/frontend build

FROM nginx:alpine AS runner

COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
