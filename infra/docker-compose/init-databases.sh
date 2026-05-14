#!/usr/bin/env bash
# Postgres init script — creates one logical DB per Tukio service + Keycloak.
# Runs ONCE at first container start (postgres:alpine docker-entrypoint convention).
#
# Each backend service connects to its own DB (NFR — database per service).
# Users + DBs share the same name for simplicity; ownership granted at create.

set -euo pipefail

PG_USER=$(cat /run/secrets/pg_user)

createdb_if_missing() {
  local db="$1"
  echo "── ensuring DB '$db' exists..."
  psql -v ON_ERROR_STOP=1 --username "$PG_USER" --dbname postgres <<-EOSQL
    SELECT 'CREATE DATABASE $db OWNER $PG_USER'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')
    \\gexec
EOSQL
}

# 1 DB per service + 1 for Keycloak.
for db in \
  tukio_identity \
  tukio_catalog \
  tukio_booking \
  tukio_order \
  tukio_payment \
  tukio_messaging \
  tukio_review \
  tukio_notification \
  tukio_media \
  keycloak; do
  createdb_if_missing "$db"
done

echo "✅ Tukio Postgres init complete (9 service DBs + keycloak)."
