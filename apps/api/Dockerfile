# Production image for the API.
#
# Build context is the repository root, because the npm workspace lockfile lives
# there and a workspace install cannot be reproduced from apps/api alone.
#
#   docker build -f apps/api/Dockerfile -t pomodoro-api .

# ---------------------------------------------------------------------------
# Builder: full dependency tree, Prisma client generation, TypeScript build.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

# Manifests first: this layer is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
RUN npm ci

COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN npx prisma generate && npm run build

# Drop development dependencies. The Prisma CLI survives because it is a runtime
# dependency here: migrations are applied when the container starts, and
# `migrate deploy` needs it.
#
# The client is regenerated afterwards, since pruning removes the generated
# output along with the extraneous packages it sits beside.
WORKDIR /app
RUN npm prune --omit=dev \
 && cd apps/api && npx --no-install prisma generate

# ---------------------------------------------------------------------------
# Runtime: compiled output, production dependencies, migrations. No sources.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime

# dumb-init reaps zombies and forwards signals, so Nest's shutdown hooks run and
# Prisma closes its pool instead of the container being killed outright.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

# --chown on the COPY itself: a `RUN chown -R` would rewrite every file and
# duplicate the whole dependency tree into a second layer.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --chmod=755 apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER node
WORKDIR /app/apps/api

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
