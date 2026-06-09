#!/bin/sh
# Docker Entrypoint for Salon Frontend Apps
# Seeds database and creates admin user on first startup, then runs Next.js
#
# Required environment variables:
#   APP_NAME - The app directory name (e.g., frontend-schnittwerk, frontend-template)
#
# Optional environment variables:
#   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME
#   SUPERADMIN_ENABLED, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD (BeautifyPro Support)

set -e

# App configuration
APP_NAME="${APP_NAME:-frontend-schnittwerk}"

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
ADMIN_FIRST_NAME="${ADMIN_FIRST_NAME:-Admin}"
ADMIN_LAST_NAME="${ADMIN_LAST_NAME:-User}"

# Superadmin (BeautifyPro Support) configuration
SUPERADMIN_ENABLED="${SUPERADMIN_ENABLED:-false}"
SUPERADMIN_EMAIL="${SUPERADMIN_EMAIL:-}"
SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-}"
SUPABASE_URL="${SUPABASE_URL_INTERNAL:-http://kong:8000}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
SEED_FILE="/app/seed.sql"
MIGRATIONS_DIR="/app/migrations"

# Setup Wizard configuration
ENABLE_WIZARD="${ENABLE_WIZARD:-false}"

# Function to wait for database to be ready
wait_for_db() {
    echo "[init] Waiting for database to be ready..."
    for i in $(seq 1 30); do
        ready=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
            "SELECT 1;" 2>/dev/null || echo "")

        if [ "$ready" = "1" ]; then
            echo "[init] Database is ready!"
            return 0
        fi

        echo "[init] Waiting for database... ($i/30)"
        sleep 2
    done

    echo "[init] Warning: Database not ready after 60 seconds"
    return 1
}

# Function to run pending database migrations
run_migrations() {
    echo "[init] Checking for pending migrations..."

    if [ ! -d "$MIGRATIONS_DIR" ]; then
        echo "[init] No migrations directory found at $MIGRATIONS_DIR, skipping"
        return 0
    fi

    # Create schema_migrations tracking table if it doesn't exist
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "
        CREATE TABLE IF NOT EXISTS public.schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        );
    " 2>/dev/null

    # Get list of already applied migrations
    applied=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
        "SELECT filename FROM public.schema_migrations ORDER BY filename;" 2>/dev/null || echo "")

    migration_count=0
    error_count=0

    # Process migration files in sorted order
    for migration_file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
        filename=$(basename "$migration_file")

        # Skip if already applied
        if echo "$applied" | grep -qF "$filename"; then
            continue
        fi

        echo "[init] Applying migration: $filename"

        if PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "$migration_file" 2>&1 | tail -5; then
            # Record as applied
            PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c \
                "INSERT INTO public.schema_migrations (filename) VALUES ('$filename') ON CONFLICT DO NOTHING;" 2>/dev/null
            migration_count=$((migration_count + 1))
            echo "[init] Applied: $filename"
        else
            error_count=$((error_count + 1))
            echo "[init] ERROR applying: $filename"
        fi
    done

    if [ "$migration_count" -gt 0 ]; then
        echo "[init] Applied $migration_count migration(s)"
    else
        echo "[init] All migrations already applied"
    fi

    if [ "$error_count" -gt 0 ]; then
        echo "[init] WARNING: $error_count migration(s) failed"
    fi
}

# Function to check and run seed data if needed
run_seed_if_needed() {
    echo "[init] Checking if seed data exists..."

    # Skip seeding if wizard is enabled - let the wizard handle data creation
    if [ "$ENABLE_WIZARD" = "true" ]; then
        echo "[init] Setup wizard enabled (ENABLE_WIZARD=true). Skipping seed.sql - data will be created via wizard."
        return 0
    fi

    # Check if salons table has any data
    salon_count=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
        "SELECT COUNT(*) FROM salons;" 2>/dev/null || echo "0")

    # Trim whitespace
    salon_count=$(echo "$salon_count" | tr -d ' ')

    if [ "$salon_count" = "0" ]; then
        echo "[init] No seed data found. Running seed.sql..."

        if [ -f "$SEED_FILE" ]; then
            # Run seed.sql as supabase_admin to have proper permissions
            PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "supabase_admin" -d "${DB_NAME}" -f "$SEED_FILE" 2>&1 | head -30
            echo "[init] Seed data loaded successfully!"
        else
            echo "[init] Warning: Seed file not found at $SEED_FILE"
        fi
    else
        echo "[init] Seed data already exists ($salon_count salon(s) found)"
    fi
}

# Function to check if initial admin setup has been completed
check_admin_setup_completed() {
    # Check for a marker in settings that indicates admin setup was completed
    setup_done=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
        "SELECT value FROM settings WHERE salon_id = '550e8400-e29b-41d4-a716-446655440001' AND key = 'admin_setup_completed';" 2>/dev/null || echo "")
    setup_done=$(echo "$setup_done" | tr -d ' \n\r')

    if [ "$setup_done" = "true" ]; then
        return 0  # Setup was completed
    fi
    return 1  # Setup not completed
}

# Function to mark admin setup as completed
mark_admin_setup_completed() {
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "
        INSERT INTO settings (salon_id, key, value, category, description, is_public)
        VALUES ('550e8400-e29b-41d4-a716-446655440001', 'admin_setup_completed', 'true'::jsonb, 'system', 'Marker to prevent admin password reset on rebuild', false)
        ON CONFLICT (salon_id, key) DO NOTHING;
    " 2>/dev/null
}

# Function to create admin user directly in database
create_admin_user() {
    echo "[init] Checking if admin user needs to be created..."

    # Skip admin creation if wizard is enabled - let the wizard handle it
    if [ "$ENABLE_WIZARD" = "true" ]; then
        echo "[init] Setup wizard enabled (ENABLE_WIZARD=true). Skipping admin creation - admin will be created via wizard."
        return 0
    fi

    # IMPORTANT: Check if admin setup was already completed
    # This prevents password reset on Docker rebuilds
    if check_admin_setup_completed; then
        echo "[init] Admin setup already completed (found marker). Skipping to preserve existing password."
        # Still check if user exists and link to staff if needed
        existing=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
            "SELECT id FROM auth.users WHERE email = '${ADMIN_EMAIL}';" 2>/dev/null || echo "")
        existing=$(echo "$existing" | tr -d ' ')
        if [ -n "$existing" ] && [ "$existing" != "" ]; then
            link_admin_to_staff "$existing"
        fi
        return 0
    fi

    echo "[init] Admin: ${ADMIN_FIRST_NAME} ${ADMIN_LAST_NAME} <${ADMIN_EMAIL}>"

    # Check if user already exists
    existing=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
        "SELECT id FROM auth.users WHERE email = '${ADMIN_EMAIL}';" 2>/dev/null || echo "")

    # Trim whitespace
    existing=$(echo "$existing" | tr -d ' ')

    if [ -n "$existing" ] && [ "$existing" != "" ]; then
        echo "[init] Admin user already exists (ID: $existing)"
        # Mark setup as completed since user exists
        mark_admin_setup_completed
        link_admin_to_staff "$existing"
        return 0
    fi

    echo "[init] Creating admin user..."

    # Create admin user directly in database (suppress NOTICE messages)
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc "
        DO \$\$
        DECLARE
            new_id UUID := gen_random_uuid();
        BEGIN
            -- Create auth user
            INSERT INTO auth.users (
                id, instance_id, email, encrypted_password, email_confirmed_at,
                confirmation_token, recovery_token, email_change_token_new, email_change,
                created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
                is_super_admin, aud, role
            ) VALUES (
                new_id, '00000000-0000-0000-0000-000000000000', '${ADMIN_EMAIL}',
                crypt('${ADMIN_PASSWORD}', gen_salt('bf')), NOW(),
                '', '', '', '', NOW(), NOW(),
                '{\"provider\": \"email\", \"providers\": [\"email\"]}',
                '{\"first_name\": \"${ADMIN_FIRST_NAME}\", \"last_name\": \"${ADMIN_LAST_NAME}\"}',
                false, 'authenticated', 'authenticated'
            );

            -- Create identity
            INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
            VALUES (new_id, new_id, '${ADMIN_EMAIL}',
                format('{\"sub\": \"%s\", \"email\": \"${ADMIN_EMAIL}\"}', new_id)::jsonb,
                'email', NOW(), NOW());

            -- Create profile
            INSERT INTO public.profiles (id, email, first_name, last_name)
            VALUES (new_id, '${ADMIN_EMAIL}', '${ADMIN_FIRST_NAME}', '${ADMIN_LAST_NAME}')
            ON CONFLICT (id) DO NOTHING;
        END \$\$;
    " 2>/dev/null

    # Get the created admin ID separately (clean query)
    admin_id=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
        "SELECT id FROM auth.users WHERE email = '${ADMIN_EMAIL}';" 2>/dev/null)

    # Trim whitespace
    admin_id=$(echo "$admin_id" | tr -d ' \n\r')

    if [ -n "$admin_id" ]; then
        echo "[init] Admin user created successfully! (ID: $admin_id)"
        # Mark setup as completed to prevent password reset on future rebuilds
        mark_admin_setup_completed
        link_admin_to_staff "$admin_id"
    else
        echo "[init] Warning: Could not create admin user"
    fi
}

# Function to link admin user to the first staff member
link_admin_to_staff() {
    admin_id="$1"
    if [ -z "$admin_id" ]; then
        echo "[init] No admin ID provided, skipping staff link"
        return 0
    fi

    echo "[init] Linking admin user to staff member..."

    # Check if admin staff member exists
    staff_exists=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
        "SELECT COUNT(*) FROM staff WHERE id = 'b50e8400-e29b-41d4-a716-446655440001';" 2>/dev/null || echo "0")

    staff_exists=$(echo "$staff_exists" | tr -d ' ')

    if [ "$staff_exists" = "0" ]; then
        echo "[init] Admin staff record not found, skipping link"
        return 0
    fi

    # Update staff member with admin info AND create user_roles entry
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "
        -- Update staff member with admin info
        UPDATE staff
        SET profile_id = '${admin_id}',
            display_name = '${ADMIN_FIRST_NAME} ${ADMIN_LAST_NAME}',
            email = '${ADMIN_EMAIL}'
        WHERE id = 'b50e8400-e29b-41d4-a716-446655440001';

        -- Create admin role in user_roles (required for permission checks)
        INSERT INTO user_roles (profile_id, salon_id, role_name)
        VALUES ('${admin_id}', '550e8400-e29b-41d4-a716-446655440001', 'admin')
        ON CONFLICT (profile_id, salon_id, role_name) DO NOTHING;
    " 2>/dev/null && echo "[init] Staff member linked to admin with role!" || echo "[init] Warning: Could not link staff member"
}

# Function to create superadmin (BeautifyPro Support) user
# NOTE: This user is NOT added to staff table, so they won't appear
# in staff lists or booking pages. Access is controlled by environment variables.
create_superadmin_user() {
    # Skip if superadmin is not enabled
    if [ "$SUPERADMIN_ENABLED" != "true" ]; then
        echo "[init] Superadmin not enabled (SUPERADMIN_ENABLED != true)"
        return 0
    fi

    # Validate required fields
    if [ -z "$SUPERADMIN_EMAIL" ]; then
        echo "[init] Warning: SUPERADMIN_ENABLED=true but SUPERADMIN_EMAIL is not set, skipping"
        return 0
    fi

    if [ -z "$SUPERADMIN_PASSWORD" ]; then
        echo "[init] Warning: SUPERADMIN_ENABLED=true but SUPERADMIN_PASSWORD is not set, skipping"
        return 0
    fi

    echo "[init] Checking if superadmin (BeautifyPro Support) user needs to be created..."
    echo "[init] Superadmin: BeautifyPro Support <${SUPERADMIN_EMAIL}>"

    # Check if superadmin user already exists
    existing=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
        "SELECT id FROM auth.users WHERE email = '${SUPERADMIN_EMAIL}';" 2>/dev/null || echo "")

    # Trim whitespace
    existing=$(echo "$existing" | tr -d ' ')

    if [ -n "$existing" ] && [ "$existing" != "" ]; then
        echo "[init] Superadmin user already exists (ID: $existing)"
        return 0
    fi

    echo "[init] Creating superadmin (BeautifyPro Support) user..."

    # Create superadmin user directly in database (NO staff entry - invisible to customers)
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc "
        DO \$\$
        DECLARE
            new_id UUID := gen_random_uuid();
        BEGIN
            -- Create auth user for superadmin
            INSERT INTO auth.users (
                id, instance_id, email, encrypted_password, email_confirmed_at,
                confirmation_token, recovery_token, email_change_token_new, email_change,
                created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
                is_super_admin, aud, role
            ) VALUES (
                new_id, '00000000-0000-0000-0000-000000000000', '${SUPERADMIN_EMAIL}',
                crypt('${SUPERADMIN_PASSWORD}', gen_salt('bf')), NOW(),
                '', '', '', '', NOW(), NOW(),
                '{\"provider\": \"email\", \"providers\": [\"email\"]}',
                '{\"first_name\": \"BeautifyPro\", \"last_name\": \"Support\", \"is_support_account\": true}',
                false, 'authenticated', 'authenticated'
            );

            -- Create identity
            INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
            VALUES (new_id, new_id, '${SUPERADMIN_EMAIL}',
                format('{\"sub\": \"%s\", \"email\": \"${SUPERADMIN_EMAIL}\"}', new_id)::jsonb,
                'email', NOW(), NOW());

            -- Create profile (required for auth to work)
            INSERT INTO public.profiles (id, email, first_name, last_name)
            VALUES (new_id, '${SUPERADMIN_EMAIL}', 'BeautifyPro', 'Support')
            ON CONFLICT (id) DO NOTHING;

            -- NOTE: We do NOT create a staff entry for superadmin
            -- This ensures they are invisible in staff lists and booking pages
        END \$\$;
    " 2>/dev/null

    # Get the created superadmin ID separately (clean query)
    superadmin_id=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
        "SELECT id FROM auth.users WHERE email = '${SUPERADMIN_EMAIL}';" 2>/dev/null)

    # Trim whitespace
    superadmin_id=$(echo "$superadmin_id" | tr -d ' \n\r')

    if [ -n "$superadmin_id" ]; then
        echo "[init] Superadmin (BeautifyPro Support) created successfully! (ID: $superadmin_id)"
    else
        echo "[init] Warning: Could not create superadmin user"
    fi
}

# Function to configure storage buckets (runs after storage-api has set up schema)
configure_storage_buckets() {
    echo "[init] Configuring storage buckets..."

    # Wait a moment for storage-api to be ready and run its migrations
    sleep 5

    # Check if the 'public' column exists (added by storage-api)
    public_col=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'public';" 2>/dev/null || echo "")

    public_col=$(echo "$public_col" | tr -d ' ')

    if [ "$public_col" = "public" ]; then
        echo "[init] Storage schema ready, configuring buckets..."

        PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "
            -- Configure gallery bucket
            UPDATE storage.buckets SET
                public = true,
                file_size_limit = 5242880,
                allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            WHERE id = 'gallery';

            -- Configure staff-avatars bucket
            UPDATE storage.buckets SET
                public = true,
                file_size_limit = 5242880,
                allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            WHERE id = 'staff-avatars';

            -- Configure salon-logos bucket
            UPDATE storage.buckets SET
                public = true,
                file_size_limit = 5242880,
                allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
            WHERE id = 'salon-logos';

            -- Configure about-images bucket
            UPDATE storage.buckets SET
                public = true,
                file_size_limit = 10485760,
                allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            WHERE id = 'about-images';

            -- Configure team-images bucket
            UPDATE storage.buckets SET
                public = true,
                file_size_limit = 10485760,
                allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            WHERE id = 'team-images';

            -- Configure hero-images bucket
            UPDATE storage.buckets SET
                public = true,
                file_size_limit = 10485760,
                allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            WHERE id = 'hero-images';

            -- Configure product-images bucket
            UPDATE storage.buckets SET
                public = true,
                file_size_limit = 5242880,
                allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            WHERE id = 'product-images';
        " 2>/dev/null && echo "[init] Storage buckets configured!" || echo "[init] Warning: Could not configure buckets"
    else
        echo "[init] Storage schema not ready yet, buckets will use defaults"
    fi
}

# Main initialization function
init_database() {
    if ! wait_for_db; then
        echo "[init] Skipping database initialization"
        return 1
    fi

    # Set passwords for all Supabase system roles
    # This must happen before other services try to connect
    echo "[init] Setting Supabase role passwords..."
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "
        ALTER ROLE supabase_auth_admin WITH PASSWORD '${DB_PASSWORD}';
        ALTER ROLE supabase_storage_admin WITH PASSWORD '${DB_PASSWORD}';
        ALTER ROLE authenticator WITH PASSWORD '${DB_PASSWORD}';
        ALTER ROLE supabase_admin WITH PASSWORD '${DB_PASSWORD}';
    " 2>/dev/null && echo "[init] Supabase role passwords set!" || echo "[init] Warning: Could not set role passwords"

    # Run pending migrations first
    run_migrations

    # Run seed data (creates salon, staff records, etc.)
    run_seed_if_needed

    # Then create admin user and link to staff
    create_admin_user

    # Create superadmin (BeautifyPro Support) if enabled
    create_superadmin_user

    # Configure storage buckets (after storage-api has set up schema)
    configure_storage_buckets

    echo "[init] Database initialization complete!"
}

# Run initialization in background (non-blocking)
init_database &

# Start the Next.js application
echo "[init] Starting Next.js application (${APP_NAME})..."
exec node apps/${APP_NAME}/server.js
