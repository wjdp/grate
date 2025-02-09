ARG NODE_VERSION=20.17.0
FROM node:${NODE_VERSION}-slim AS base

ARG PORT=3000
WORKDIR /app

# Stage to build the app
FROM base AS build

RUN npm install -g pnpm
COPY --link package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY --link . .
RUN pnpm build

# Stage to release the app
FROM base AS release

ENV PORT=$PORT
ENV NODE_ENV=production

COPY --from=build /app/.output /app/.output

# Optional, only needed if you rely on unbundled dependencies
# COPY --from=build /src/node_modules /src/node_modules

CMD [ "node", ".output/server/index.mjs" ]
