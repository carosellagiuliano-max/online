#!/bin/bash
# ============================================
# BeautifyPRO - Admin User Setup Script
# ============================================
# This script creates the admin user and first staff member
# using environment variables for configuration.
#
# Usage:
#   ./scripts/setup-admin.sh
#
# Required environment variables:
#   ADMIN_EMAIL       - Admin email address
#   ADMIN_PASSWORD    - Admin password
#   ADMIN_FIRST_NAME  - Admin first name
#   ADMIN_LAST_NAME   - Admin last name
#
# Optional:
#   SUPABASE_DB_URL     - Database connection string
#                         (defaults to local Supabase)
#   SUPERADMIN_ENABLED  - Set to 'true' to create support account
#   SUPERADMIN_EMAIL    - BeautifyPro support email
#   SUPERADMIN_PASSWORD - BeautifyPro support password
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load .env file if it exists (check multiple locations)
ENV_FILE=""
if [ -f "../../apps/frontend-schnittwerk/.env" ]; then
    ENV_FILE="../../apps/frontend-schnittwerk/.env"
elif [ -f "../../../apps/frontend-schnittwerk/.env" ]; then
    ENV_FILE="../../../apps/frontend-schnittwerk/.env"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
fi

if [ -n "$ENV_FILE" ]; then
    echo -e "${YELLOW}Loading environment from $ENV_FILE${NC}"
    set -a
    source "$ENV_FILE"
    set +a
fi

# Validate required environment variables
if [ -z "$ADMIN_EMAIL" ]; then
    echo -e "${RED}Error: ADMIN_EMAIL is required${NC}"
    exit 1
fi

if [ -z "$ADMIN_PASSWORD" ]; then
    echo -e "${RED}Error: ADMIN_PASSWORD is required${NC}"
    exit 1
fi

if [ -z "$ADMIN_FIRST_NAME" ]; then
    echo -e "${RED}Error: ADMIN_FIRST_NAME is required${NC}"
    exit 1
fi

if [ -z "$ADMIN_LAST_NAME" ]; then
    echo -e "${RED}Error: ADMIN_LAST_NAME is required${NC}"
    exit 1
fi

# Default database URL for local Supabase
DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@localhost:54322/postgres}"

echo -e "${GREEN}Creating admin user...${NC}"
echo "  Email: $ADMIN_EMAIL"
echo "  Name: $ADMIN_FIRST_NAME $ADMIN_LAST_NAME"

# Generate a UUID for the admin user
ADMIN_UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')

# SQL to create admin user
SQL=$(cat <<EOF
-- Create admin user with environment-configured values
DO \$\$
DECLARE
    admin_id UUID := '$ADMIN_UUID';
    admin_email TEXT := '$ADMIN_EMAIL';
    admin_password TEXT := '$ADMIN_PASSWORD';
    admin_first_name TEXT := '$ADMIN_FIRST_NAME';
    admin_last_name TEXT := '$ADMIN_LAST_NAME';
    salon_id UUID := '550e8400-e29b-41d4-a716-446655440001';
BEGIN
    -- Check if auth.users table exists with expected columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'auth'
        AND table_name = 'users'
        AND column_name = 'email_confirmed_at'
    ) THEN
        -- Check if admin already exists by email
        IF EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
            RAISE NOTICE 'Admin user with email % already exists, skipping creation', admin_email;
            -- Get existing admin ID for staff linking
            SELECT id INTO admin_id FROM auth.users WHERE email = admin_email;
        ELSE
            -- Create auth user
            INSERT INTO auth.users (
                id,
                instance_id,
                email,
                encrypted_password,
                email_confirmed_at,
                confirmation_token,
                recovery_token,
                email_change_token_new,
                email_change,
                created_at,
                updated_at,
                raw_app_meta_data,
                raw_user_meta_data,
                is_super_admin,
                aud,
                role
            ) VALUES (
                admin_id,
                '00000000-0000-0000-0000-000000000000',
                admin_email,
                crypt(admin_password, gen_salt('bf')),
                NOW(),
                '',
                '',
                '',
                '',
                NOW(),
                NOW(),
                '{"provider": "email", "providers": ["email"]}',
                format('{"first_name": "%s", "last_name": "%s"}', admin_first_name, admin_last_name)::jsonb,
                false,
                'authenticated',
                'authenticated'
            );

            -- Create identity for the user
            INSERT INTO auth.identities (
                id,
                user_id,
                provider_id,
                identity_data,
                provider,
                created_at,
                updated_at
            ) VALUES (
                admin_id,
                admin_id,
                admin_email,
                format('{"sub": "%s", "email": "%s"}', admin_id, admin_email)::jsonb,
                'email',
                NOW(),
                NOW()
            );

            -- Create profile for admin user
            INSERT INTO public.profiles (id, email, first_name, last_name)
            VALUES (admin_id, admin_email, admin_first_name, admin_last_name)
            ON CONFLICT (id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name;

            RAISE NOTICE 'Admin user created: % %', admin_first_name, admin_last_name;
        END IF;

        -- Create or update admin as first staff member
        INSERT INTO staff (
            id,
            salon_id,
            profile_id,
            display_name,
            job_title,
            bio,
            specialties,
            is_bookable,
            is_active,
            sort_order,
            email,
            phone,
            role,
            color,
            employment_type
        ) VALUES (
            'b50e8400-e29b-41d4-a716-446655440001',
            salon_id,
            admin_id,
            admin_first_name || ' ' || admin_last_name,
            'Inhaberin & Master Stylistin',
            'Mit über 15 Jahren Erfahrung und einer Leidenschaft für innovative Farbtechniken.',
            ARRAY['Balayage', 'Colorationen', 'Brautfrisuren'],
            true,
            true,
            1,
            admin_email,
            '+41 71 234 56 78',
            'admin',
            '#e11d48',
            'full_time'
        )
        ON CONFLICT (id) DO UPDATE SET
            profile_id = EXCLUDED.profile_id,
            display_name = EXCLUDED.display_name,
            email = EXCLUDED.email;

        RAISE NOTICE 'Admin staff member linked successfully';
    ELSE
        RAISE NOTICE 'Auth schema not ready - run this script after Supabase auth service starts';
    END IF;
END \$\$;
EOF
)

# Execute the SQL
echo "$SQL" | psql "$DB_URL" -v ON_ERROR_STOP=1

echo -e "${GREEN}Admin user setup complete!${NC}"

# ============================================
# SUPERADMIN (BeautifyPro Support) SETUP
# ============================================
# Creates a support account that can access /admin
# but is NOT visible in staff lists or booking

if [ "$SUPERADMIN_ENABLED" = "true" ]; then
    if [ -z "$SUPERADMIN_EMAIL" ]; then
        echo -e "${YELLOW}Warning: SUPERADMIN_ENABLED=true but SUPERADMIN_EMAIL is not set, skipping${NC}"
    elif [ -z "$SUPERADMIN_PASSWORD" ]; then
        echo -e "${YELLOW}Warning: SUPERADMIN_ENABLED=true but SUPERADMIN_PASSWORD is not set, skipping${NC}"
    else
        echo -e "${GREEN}Creating superadmin (BeautifyPro Support) user...${NC}"
        echo "  Email: $SUPERADMIN_EMAIL"

        # Generate a UUID for the superadmin user
        SUPERADMIN_UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')

        # SQL to create superadmin user (NO staff entry - invisible to customers)
        SUPERADMIN_SQL=$(cat <<EOF
-- Create superadmin (BeautifyPro Support) user
-- NOTE: This user is NOT added to staff table, so they won't appear
-- in staff lists or booking pages. Access is controlled by environment variables.
DO \$\$
DECLARE
    superadmin_id UUID := '$SUPERADMIN_UUID';
    superadmin_email TEXT := '$SUPERADMIN_EMAIL';
    superadmin_password TEXT := '$SUPERADMIN_PASSWORD';
BEGIN
    -- Check if auth.users table exists with expected columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'auth'
        AND table_name = 'users'
        AND column_name = 'email_confirmed_at'
    ) THEN
        -- Check if superadmin already exists by email
        IF EXISTS (SELECT 1 FROM auth.users WHERE email = superadmin_email) THEN
            RAISE NOTICE 'Superadmin user with email % already exists, skipping creation', superadmin_email;
        ELSE
            -- Create auth user for superadmin
            INSERT INTO auth.users (
                id,
                instance_id,
                email,
                encrypted_password,
                email_confirmed_at,
                confirmation_token,
                recovery_token,
                email_change_token_new,
                email_change,
                created_at,
                updated_at,
                raw_app_meta_data,
                raw_user_meta_data,
                is_super_admin,
                aud,
                role
            ) VALUES (
                superadmin_id,
                '00000000-0000-0000-0000-000000000000',
                superadmin_email,
                crypt(superadmin_password, gen_salt('bf')),
                NOW(),
                '',
                '',
                '',
                '',
                NOW(),
                NOW(),
                '{"provider": "email", "providers": ["email"]}',
                '{"first_name": "BeautifyPro", "last_name": "Support", "is_support_account": true}'::jsonb,
                false,
                'authenticated',
                'authenticated'
            );

            -- Create identity for the superadmin
            INSERT INTO auth.identities (
                id,
                user_id,
                provider_id,
                identity_data,
                provider,
                created_at,
                updated_at
            ) VALUES (
                superadmin_id,
                superadmin_id,
                superadmin_email,
                format('{"sub": "%s", "email": "%s"}', superadmin_id, superadmin_email)::jsonb,
                'email',
                NOW(),
                NOW()
            );

            -- Create profile for superadmin (required for auth to work)
            INSERT INTO public.profiles (id, email, first_name, last_name)
            VALUES (superadmin_id, superadmin_email, 'BeautifyPro', 'Support')
            ON CONFLICT (id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name;

            RAISE NOTICE 'Superadmin (BeautifyPro Support) user created';
        END IF;
    ELSE
        RAISE NOTICE 'Auth schema not ready for superadmin creation';
    END IF;
END \$\$;
EOF
        )

        # Execute the superadmin SQL
        echo "$SUPERADMIN_SQL" | psql "$DB_URL" -v ON_ERROR_STOP=1

        echo -e "${GREEN}Superadmin (BeautifyPro Support) setup complete!${NC}"
    fi
else
    echo -e "${YELLOW}Superadmin not enabled (set SUPERADMIN_ENABLED=true to enable)${NC}"
fi
