#!/bin/sh
# Creates one database per microservice inside the shared Postgres container.
# Runs automatically on first container start (empty data volume).
# NOTE: postgres:*-alpine ships only /bin/sh (no bash), so keep this POSIX-compatible.
set -eu

create_db() {
  db="$1"
  echo "  creating database '$db'"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE "$db"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
EOSQL
}

create_db "${AUTH_DB_NAME:-auth_db}"
create_db "${CORE_DB_NAME:-core_db}"
