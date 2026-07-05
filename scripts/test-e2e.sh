#!/bin/sh
# One-command test runner: brings up Postgres, applies migrations, then runs the
# full suite (unit + e2e). Pass a path to narrow, e.g.:
#   npm run test:e2e -- test/api.e2e.spec.ts
set -e

echo "▶ Starting Postgres (docker compose)..."
docker compose up -d postgres

echo "▶ Waiting for Postgres to accept connections..."
for i in $(seq 1 30); do
  if docker exec iam-postgres pg_isready -U iam -d iam >/dev/null 2>&1; then
    echo "  Postgres ready."
    break
  fi
  sleep 1
done

echo "▶ Applying migrations..."
npx prisma migrate deploy

echo "▶ Running tests..."
npx jest --runInBand "$@"
