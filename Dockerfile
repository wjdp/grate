ARG NODE_VERSION=20.17.0
FROM node:${NODE_VERSION}-slim AS base

WORKDIR /app

# --- Stage to build the app ---
FROM base AS build

# Prisma needs openssl at build time to build against
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm
COPY --link package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY --link . .
RUN pnpm build

FROM base AS runtime

# Prisma needs openssl at build time to build against
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm
COPY --link package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --link . .
RUN pnpm prisma generate

# --- Stage to release the app ---
FROM base AS release

ENV NODE_ENV=production

# Prisma needs openssl at runtime
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

COPY --from=runtime /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/run.sh /app/run.sh
COPY --from=build /app/.output /app/.output

ENV DATABASE_URL="file:/app/data/db.sqlite"

CMD [ "bash", "/app/run.sh" ]
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl --fail http://localhost:3000/health || exit 1
