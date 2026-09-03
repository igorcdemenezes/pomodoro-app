#!/bin/sh
# Applies pending migrations before the process starts serving.
#
# `migrate deploy` only applies migrations already committed to the repository —
# it never generates one and never resets — so it is safe to run on every boot,
# and it is idempotent when several instances start at once.
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

echo "Applying database migrations..."
npx --no-install prisma migrate deploy

echo "Starting API..."
exec "$@"
