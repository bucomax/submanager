# syntax=docker/dockerfile:1.7
# Imagem de produção do SubManager para Cloud Run (Next.js standalone + Prisma).

FROM node:24-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── Dependências (inclui CLI do Prisma: o Cloud Build usa este estágio para `migrate deploy`)
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
COPY packages ./packages
COPY patches ./patches
RUN npm ci --ignore-scripts \
  && npx prisma generate --schema=packages/prisma/schema.prisma \
  && npx patch-package

# ── Build do Next
FROM deps AS build
COPY . .
# NEXT_PUBLIC_* são embutidas no bundle do browser em tempo de build; o CSP (frame-src)
# também é calculado no build a partir de ALLOWED_IFRAME_ORIGINS.
ARG ALLOWED_IFRAME_ORIGINS
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_PERSIST_SECRET
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
ENV ALLOWED_IFRAME_ORIGINS=$ALLOWED_IFRAME_ORIGINS \
  NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
  NEXT_PUBLIC_APP_PERSIST_SECRET=$NEXT_PUBLIC_APP_PERSIST_SECRET \
  NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
  NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT
# Turbopack + Sentry passam de 2 GB de heap no build de produção.
RUN NODE_OPTIONS=--max-old-space-size=6144 npm run build

# ── Runtime
FROM base AS runner
ENV NODE_ENV=production \
  PORT=8080 \
  HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
