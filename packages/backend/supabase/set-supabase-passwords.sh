#!/bin/bash
# Sets passwords for internal Supabase roles using SUPABASE_DB_PASSWORD env var.
#
# Mounted at /docker-entrypoint-initdb.d/zzz-set-supabase-passwords.sh — the
# "zzz" prefix is REQUIRED so this runs AFTER the image's bundled migrate.sh,
# which creates the supabase_* roles. A digit/"99" prefix sorts BEFORE
# "migrate.sh" (9 < m) and would run before the roles exist, erroring out and
# aborting DB initialization entirely.
#
# Each ALTER is best-effort (a missing role must not abort init), so we don't
# use ON_ERROR_STOP here.

SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD:-postgres}"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    ALTER ROLE supabase_auth_admin WITH PASSWORD '${SUPABASE_DB_PASSWORD}';
    ALTER ROLE supabase_storage_admin WITH PASSWORD '${SUPABASE_DB_PASSWORD}';
    ALTER ROLE authenticator WITH PASSWORD '${SUPABASE_DB_PASSWORD}';
    ALTER ROLE supabase_admin WITH PASSWORD '${SUPABASE_DB_PASSWORD}';
EOSQL

exit 0
