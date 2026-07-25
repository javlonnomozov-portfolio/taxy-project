# TTY Telegram bot — Railway uchun (build context = repo root).
# Railway: Root Directory = "/", Dockerfile Path = "apps/bot/Dockerfile".
# Bu worker servis (port ochmaydi) — BOT_TOKEN va API_BASE_URL kerak.
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/bot/package.json ./apps/bot/
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/bot ./apps/bot
RUN pnpm --filter @tty/shared build && pnpm --filter @tty/bot build
RUN pnpm --filter @tty/bot deploy --prod /out

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /out /app
CMD ["node", "dist/main.js"]
