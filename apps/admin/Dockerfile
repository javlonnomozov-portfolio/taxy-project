# TTY Admin/Operator paneli — Railway uchun (build context = repo root).
# Railway: Root Directory = "/", Dockerfile Path = "apps/admin/Dockerfile".
# VITE_API_URL build vaqtida bog'lanadi (Railway service variable → build arg).
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/admin/package.json ./apps/admin/
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/admin ./apps/admin

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @tty/shared build && pnpm --filter @tty/admin build

# Statik fayllarni nginx orqali (Railway PORT bilan)
FROM nginx:1.27-alpine AS runtime
COPY --from=builder /repo/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx/default.conf.template /etc/nginx/templates/default.conf.template
# nginx rasm entrypoint'i templates'ni envsubst qiladi ($PORT bilan) va ishga tushiradi.
EXPOSE 8080
