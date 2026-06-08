#!/bin/sh
set -e

echo "[entrypoint] Aguardando PostgreSQL em $DB_HOST:$DB_PORT..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  sleep 2
done

echo "[entrypoint] PostgreSQL pronto. Aplicando migration..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -f /app/migrations/001_create_tables.sql

echo "[entrypoint] Iniciando servidor..."
exec node server.js
