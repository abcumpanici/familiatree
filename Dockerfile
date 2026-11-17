FROM oven/bun:1.3.5 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/domain/package.json packages/domain/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.3.5-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/domain/package.json packages/domain/
RUN bun install --frozen-lockfile --production --filter '@familytree/server'
COPY packages/domain packages/domain
COPY apps/server apps/server
COPY skills skills
COPY --from=build /app/apps/web/dist apps/web/dist
ARG APP_USER=bun
RUN mkdir -p /data && chown bun:bun /data
USER ${APP_USER}
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "apps/server/src/main.ts"]
