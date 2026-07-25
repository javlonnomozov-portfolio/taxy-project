# TTY API — Railway uchun (build context = repo root).
# Railway: Root Directory = "/", Dockerfile Path = "apps/api/Dockerfile".
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo

# Lockfile va workspace manifestlari (kesh uchun avval)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# Manba kod
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @tty/shared build && pnpm --filter @tty/api build

# Self-contained prod bundle (workspace deps in'ektsiya qilinadi)
RUN pnpm --filter @tty/api deploy --prod /out

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /out /app
EXPOSE 3000
# Migratsiya → API start
CMD ["sh", "-c", "node dist/database/run-migrations.js && node dist/main.js"]
