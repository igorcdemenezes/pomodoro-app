#!/bin/sh
# Creates the dedicated database used by the integration test suite.
#
# Integration tests run against real PostgreSQL because the guarantees under
# test — the partial unique index on active sessions, CHECK constraints and
# foreign keys — do not exist in an in-memory substitute. Keeping them in a
# separate database means a test run never truncates development data.
#
# Runs only on first initialisation of an empty data directory.
set -eu

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
    CREATE DATABASE "${TEST_DATABASE}";
SQL

echo "created test database: ${TEST_DATABASE}"
