-- ============================================
-- DATABASE SEED TEMPLATE
-- For development and testing only
-- ============================================
--
-- INSTRUCTIONS:
-- 1. Copy this file to your new customer app
-- 2. Replace all [CHANGE] placeholders with customer-specific values
-- 3. Update salon info, services, staff, products, etc.
-- 4. Run after migrations: psql -f seed.sql
--
-- ============================================

-- ============================================
-- 0. ADMIN USER SETUP
-- ============================================
-- NOTE: Admin user creation is handled by the setup-admin.sh script
-- which uses environment variables for configuration:
--   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME
--
-- Run: ./scripts/setup-admin.sh after starting Supabase
-- ============================================

-- ============================================
-- 1. CREATE SALON [CHANGE ALL VALUES]
-- ============================================

INSERT INTO salons (
  id, name, slug, address, zip_code, city, country, phone, email, website,
  timezone, currency, default_vat_rate, is_active,
  -- Extended config fields (from migration 00044)
  tagline, owner_name, locale, instagram_url, facebook_url,
  seo_title, seo_description, seo_keywords
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Your Salon Name',                    -- [CHANGE] Salon name
  'your-salon-slug',                    -- [CHANGE] URL slug
  'Street Address 123',                 -- [CHANGE] Street address
  '12345',                              -- [CHANGE] ZIP code
  'City Name',                          -- [CHANGE] City
  'Country',                            -- [CHANGE] Country
  '+41 00 000 00 00',                   -- [CHANGE] Phone
  'info@example.com',                   -- [CHANGE] Email
  'https://example.com',                -- [CHANGE] Website
  'Europe/Zurich',                      -- [CHANGE] Timezone
  'CHF',                                -- [CHANGE] Currency
  8.1,                                  -- [CHANGE] VAT rate
  true,
  -- Extended config
  'Your tagline here',                  -- [CHANGE] Tagline
  'Owner Name',                         -- [CHANGE] Owner name
  'de-CH',                              -- [CHANGE] Locale (de-CH, de-DE, en-US, etc.)
  NULL,                                 -- [CHANGE] Instagram URL (optional)
  NULL,                                 -- [CHANGE] Facebook URL (optional)
  'Premium Salon',                      -- [CHANGE] SEO title
  'Your salon description for search engines.', -- [CHANGE] SEO description
  ARRAY['Salon', 'Hair', 'Beauty']      -- [CHANGE] SEO keywords
);

-- ============================================
-- 2. CREATE OPENING HOURS [CHANGE TIMES]
-- ============================================

INSERT INTO opening_hours (salon_id, day_of_week, open_time, close_time, is_open) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 0, '09:00', '18:00', true),  -- Monday
  ('550e8400-e29b-41d4-a716-446655440001', 1, '09:00', '18:00', true),  -- Tuesday
  ('550e8400-e29b-41d4-a716-446655440001', 2, '09:00', '18:00', true),  -- Wednesday
  ('550e8400-e29b-41d4-a716-446655440001', 3, '09:00', '18:00', true),  -- Thursday
  ('550e8400-e29b-41d4-a716-446655440001', 4, '09:00', '18:00', true),  -- Friday
  ('550e8400-e29b-41d4-a716-446655440001', 5, '09:00', '14:00', true),  -- Saturday
  ('550e8400-e29b-41d4-a716-446655440001', 6, '00:00', '23:59', false); -- Sunday (closed)

-- ============================================
-- 3. CREATE SERVICE CATEGORIES [CHANGE]
-- ============================================

INSERT INTO service_categories (id, salon_id, name, slug, description, sort_order) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Haircuts', 'haircuts', 'Professional haircuts', 1),
  ('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Coloring', 'coloring', 'Hair coloring services', 2),
  ('650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'Treatments', 'treatments', 'Hair treatments', 3),
  ('650e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 'Styling', 'styling', 'Professional styling', 4);

-- ============================================
-- 4. CREATE SERVICES [CHANGE]
-- ============================================

-- Example services - customize for your salon
INSERT INTO services (id, salon_id, category_id, name, slug, description, duration_minutes, price_cents, price_from, is_bookable_online, sort_order) VALUES
  ('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'Women Haircut', 'women-haircut', 'Wash, cut, and blow dry', 60, 7500, true, true, 1),
  ('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'Men Haircut', 'men-haircut', 'Wash, cut, and style', 30, 4500, false, true, 2),
  ('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', 'Full Color', 'full-color', 'Complete hair coloring', 90, 9500, true, true, 1),
  ('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440003', 'Deep Treatment', 'deep-treatment', 'Intensive hair treatment', 30, 3500, false, true, 1);

-- ============================================
-- 5. CREATE PRODUCT CATEGORIES [CHANGE]
-- ============================================

INSERT INTO product_categories (id, salon_id, name, slug, description, sort_order) VALUES
  ('850e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Shampoo', 'shampoo', 'Hair shampoos', 1),
  ('850e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Conditioner', 'conditioner', 'Hair conditioners', 2),
  ('850e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'Styling', 'styling', 'Styling products', 3),
  ('850e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 'Gift Cards', 'gift-cards', 'Gift vouchers', 4);

-- ============================================
-- 6. CREATE PRODUCTS [CHANGE]
-- ============================================

INSERT INTO products (id, salon_id, category_id, name, slug, description, brand, sku, price_cents, stock_quantity, is_featured, sort_order) VALUES
  ('950e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', 'Example Shampoo', 'example-shampoo', 'Professional shampoo', 'Brand', 'SH-001', 2900, 10, true, 1);

-- ============================================
-- 7. CREATE LOYALTY PROGRAM [CHANGE]
-- ============================================

INSERT INTO loyalty_programs (id, salon_id, name, description, points_per_chf, points_value_cents, birthday_bonus_points) VALUES
  ('a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Loyalty Points', 'Earn points with every visit.', 1, 1, 100);

INSERT INTO loyalty_tiers (id, program_id, name, description, min_points, points_multiplier, discount_percent, sort_order) VALUES
  ('a60e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', 'Bronze', 'Welcome to the program', 0, 1.00, 0, 1),
  ('a60e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440001', 'Silver', 'Loyalty pays off', 500, 1.25, 5, 2),
  ('a60e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440001', 'Gold', 'VIP status', 1500, 1.50, 10, 3);

-- ============================================
-- 8. CREATE NOTIFICATION TEMPLATES [CHANGE]
-- ============================================
-- Replace "Your Salon" with your salon name

INSERT INTO notification_templates (salon_id, name, code, channel, subject, body_html, available_variables) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Appointment Confirmation', 'appointment_confirmation', 'email',
   'Your appointment at Your Salon',
   '<h1>Hello {{customer_name}},</h1><p>Your appointment has been confirmed:</p><p><strong>Date:</strong> {{appointment_date}}<br><strong>Time:</strong> {{appointment_time}}<br><strong>Service:</strong> {{service_name}}</p><p>We look forward to seeing you!</p><p>Your Salon Team</p>',
   '["customer_name", "appointment_date", "appointment_time", "service_name"]'::jsonb),

  ('550e8400-e29b-41d4-a716-446655440001', 'Appointment Reminder', 'appointment_reminder', 'email',
   'Reminder: Your appointment tomorrow at Your Salon',
   '<h1>Hello {{customer_name}},</h1><p>This is a reminder about your appointment tomorrow:</p><p><strong>Date:</strong> {{appointment_date}}<br><strong>Time:</strong> {{appointment_time}}</p><p>See you soon!</p><p>Your Salon Team</p>',
   '["customer_name", "appointment_date", "appointment_time"]'::jsonb);

-- ============================================
-- 9. CREATE DEFAULT SETTINGS
-- ============================================

INSERT INTO settings (salon_id, key, value, category, description, is_public) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'booking_lead_time_hours', '1'::jsonb, 'booking', 'Minimum lead time for online bookings (hours)', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'booking_horizon_days', '90'::jsonb, 'booking', 'How far in advance can be booked (days)', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'cancellation_cutoff_hours', '24'::jsonb, 'booking', 'Cancellation deadline before appointment (hours)', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'reservation_timeout_minutes', '15'::jsonb, 'booking', 'Timeout for temporary reservations', false),
  ('550e8400-e29b-41d4-a716-446655440001', 'shop_enabled', 'true'::jsonb, 'shop', 'Online shop enabled', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'shipping_enabled', 'true'::jsonb, 'shop', 'Shipping enabled', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'shipping_cost_cents', '900'::jsonb, 'shop', 'Shipping cost in cents', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'free_shipping_threshold_cents', '10000'::jsonb, 'shop', 'Free shipping threshold', true);

-- ============================================
-- 10. CREATE DATA RETENTION POLICIES
-- ============================================

INSERT INTO data_retention_policies (salon_id, data_type, retention_days, action) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'customers_inactive', 1095, 'anonymize'),
  ('550e8400-e29b-41d4-a716-446655440001', 'notifications', 365, 'delete'),
  ('550e8400-e29b-41d4-a716-446655440001', 'audit_logs', 2555, 'delete');

-- ============================================
-- 11. CREATE STAFF MEMBERS [CHANGE]
-- ============================================
-- NOTE: The admin staff member will be updated by setup-admin.sh

INSERT INTO staff (id, salon_id, profile_id, display_name, job_title, bio, specialties, is_bookable, is_active, sort_order, email, phone, role, color, employment_type) VALUES
  ('b50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', NULL, 'Admin', 'Owner & Stylist', 'Salon owner with years of experience.', ARRAY['All Services'], true, true, 1, 'admin@example.com', '+41 00 000 00 00', 'admin', '#e11d48', 'full_time');

-- ============================================
-- 12. CREATE STAFF WORKING HOURS [CHANGE]
-- ============================================

INSERT INTO staff_working_hours (staff_id, day_of_week, start_time, end_time) VALUES
  ('b50e8400-e29b-41d4-a716-446655440001', 0, '09:00', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440001', 1, '09:00', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440001', 2, '09:00', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440001', 3, '09:00', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440001', 4, '09:00', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440001', 5, '09:00', '14:00');

-- ============================================
-- 13. CREATE STAFF SERVICE SKILLS
-- ============================================

INSERT INTO staff_service_skills (staff_id, service_id)
SELECT 'b50e8400-e29b-41d4-a716-446655440001', id
FROM services WHERE salon_id = '550e8400-e29b-41d4-a716-446655440001';

-- ============================================
-- 14. LINK STAFF TO PROFILES
-- ============================================

SELECT link_staff_to_profiles();

-- ============================================
-- 15. CREATE ABOUT PAGE VALUES [CHANGE]
-- ============================================

INSERT INTO about_values (salon_id, title, description, icon, sort_order) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Quality', 'We use only premium products.', 'award', 1),
  ('550e8400-e29b-41d4-a716-446655440001', 'Passion', 'Hair is our passion.', 'heart', 2),
  ('550e8400-e29b-41d4-a716-446655440001', 'Individuality', 'Your style is unique.', 'sparkles', 3);

-- ============================================
-- 16. CREATE ABOUT PAGE MILESTONES [CHANGE]
-- ============================================

INSERT INTO about_milestones (salon_id, year, title, description, sort_order) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '2024', 'Founded', 'Our salon opens its doors', 1);

-- ============================================
-- DONE
-- ============================================
