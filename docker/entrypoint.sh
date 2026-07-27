#!/bin/sh
set -e

# Apply pending database migrations on startup for services that own a schema.
# The gateway has no prisma/ directory, so this is skipped there.
if [ -f "prisma/schema.prisma" ]; then
  echo "[entrypoint] applying Prisma migrations..."
  ./node_modules/.bin/prisma migrate deploy
fi

exec "$@"
