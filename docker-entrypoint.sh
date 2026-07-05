#!/bin/sh
set -e

echo "▶ Applying database migrations..."
npx prisma migrate deploy

echo "▶ Seeding database (idempotent)..."
node dist/prisma/seed.js || echo "⚠ Seed step reported an issue (may already be seeded) — continuing."

echo "▶ Starting IAM Access Control Service..."
exec node dist/src/main.js
