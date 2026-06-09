-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00014_rls_policies.sql
-- Description: Row Level Security (RLS) policies
-- ============================================

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_length_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_service_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_addon_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhooks_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Get user's salon IDs
-- Already created in 00002, ensuring it exists
-- ============================================

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Staff can read profiles of customers in their salon
CREATE POLICY profiles_select_staff ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.profile_id = auth.uid()
        AND ur.role_name IN ('admin', 'manager', 'mitarbeiter')
        AND ur.salon_id IN (
          SELECT c.salon_id FROM customers c WHERE c.profile_id = profiles.id
        )
    )
  );

-- ============================================
-- SALONS POLICIES
-- ============================================

-- Public: Anyone can read active salons (for booking)
CREATE POLICY salons_select_public ON salons
  FOR SELECT
  USING (is_active = true);

-- Admin/Manager can update their salon
CREATE POLICY salons_update_staff ON salons
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE profile_id = auth.uid()
        AND salon_id = salons.id
        AND role_name IN ('admin', 'manager')
    )
  );

-- ============================================
-- USER_ROLES POLICIES
-- ============================================

-- Users can see their own roles
CREATE POLICY user_roles_select_own ON user_roles
  FOR SELECT
  USING (profile_id = auth.uid());

-- Admin can manage roles for their salon
CREATE POLICY user_roles_admin ON user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.profile_id = auth.uid()
        AND ur.salon_id = user_roles.salon_id
        AND ur.role_name = 'admin'
    )
  );

-- ============================================
-- CUSTOMERS POLICIES
-- ============================================

-- Customers can see their own record
CREATE POLICY customers_select_own ON customers
  FOR SELECT
  USING (profile_id = auth.uid());

-- Customers can update their own record
CREATE POLICY customers_update_own ON customers
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Staff can see customers in their salon
CREATE POLICY customers_select_staff ON customers
  FOR SELECT
  USING (
    salon_id IN (SELECT get_user_salon_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE profile_id = auth.uid()
        AND role_name IN ('admin', 'manager', 'mitarbeiter')
    )
  );

-- Staff can manage customers in their salon
CREATE POLICY customers_manage_staff ON customers
  FOR ALL
  USING (
    salon_id IN (SELECT get_user_salon_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE profile_id = auth.uid()
        AND role_name IN ('admin', 'manager')
    )
  );

-- ============================================
-- STAFF POLICIES
-- ============================================

-- Public: Anyone can see bookable staff (for booking)
CREATE POLICY staff_select_public ON staff
  FOR SELECT
  USING (is_active = true AND is_bookable = true);

-- Staff can see all staff in their salon
CREATE POLICY staff_select_staff ON staff
  FOR SELECT
  USING (
    salon_id IN (SELECT get_user_salon_ids(auth.uid()))
  );

-- Admin can manage staff
CREATE POLICY staff_manage_admin ON staff
  FOR ALL
  USING (
    is_admin(auth.uid(), salon_id)
  );

-- ============================================
-- SERVICES POLICIES
-- ============================================

-- Public: Anyone can see active bookable services
CREATE POLICY services_select_public ON services
  FOR SELECT
  USING (is_active = true AND is_bookable_online = true);

-- Staff can see all services in their salon
CREATE POLICY services_select_staff ON services
  FOR SELECT
  USING (
    salon_id IN (SELECT get_user_salon_ids(auth.uid()))
  );

-- Admin/Manager can manage services
CREATE POLICY services_manage_staff ON services
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE profile_id = auth.uid()
        AND salon_id = services.salon_id
        AND role_name IN ('admin', 'manager')
    )
  );

-- ============================================
-- SERVICE_CATEGORIES POLICIES
-- ============================================

-- Public: Anyone can see active categories
CREATE POLICY service_categories_select_public ON service_categories
  FOR SELECT
  USING (is_active = true);

-- Admin/Manager can manage categories
CREATE POLICY service_categories_manage_staff ON service_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE profile_id = auth.uid()
        AND salon_id = service_categories.salon_id
        AND role_name IN ('admin', 'manager')
    )
  );

-- ============================================
-- APPOINTMENTS POLICIES
-- ============================================

-- Customers can see their own appointments
CREATE POLICY appointments_select_own ON appointments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = appointments.customer_id
        AND c.profile_id = auth.uid()
    )
  );

-- Customers can create appointments (via reservation)
CREATE POLICY appointments_insert_customer ON appointments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = appointments.customer_id
        AND c.profile_id = auth.uid()
    )
  );

-- Customers can update their own pending appointments (cancel)
CREATE POLICY appointments_update_own ON appointments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = appointments.customer_id
        AND c.profile_id = auth.uid()
    )
    AND status IN ('reserved', 'requested')
  );

-- Staff can see appointments in their salon
CREATE POLICY appointments_select_staff ON appointments
  FOR SELECT
  USING (
    salon_id IN (SELECT get_user_salon_ids(auth.uid()))
    AND is_staff(auth.uid(), salon_id)
  );

-- Staff can manage appointments in their salon
CREATE POLICY appointments_manage_staff ON appointments
  FOR ALL
  USING (
    salon_id IN (SELECT get_user_salon_ids(auth.uid()))
    AND is_staff(auth.uid(), salon_id)
  );

-- ============================================
-- PRODUCTS POLICIES
-- ============================================

-- Public: Anyone can see published products
CREATE POLICY products_select_public ON products
  FOR SELECT
  USING (is_active = true AND is_published = true);

-- Staff can see all products
CREATE POLICY products_select_staff ON products
  FOR SELECT
  USING (
    salon_id IN (SELECT get_user_salon_ids(auth.uid()))
  );

-- Admin/Manager can manage products
CREATE POLICY products_manage_staff ON products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE profile_id = auth.uid()
        AND salon_id = products.salon_id
        AND role_name IN ('admin', 'manager')
    )
  );

-- ============================================
-- ORDERS POLICIES
-- ============================================

-- Customers can see their own orders
CREATE POLICY orders_select_own ON orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = orders.customer_id
        AND c.profile_id = auth.uid()
    )
  );

-- Customers can create orders
CREATE POLICY orders_insert_customer ON orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = orders.customer_id
        AND c.profile_id = auth.uid()
    )
  );

-- Staff can see orders in their salon
CREATE POLICY orders_select_staff ON orders
  FOR SELECT
  USING (
    salon_id IN (SELECT get_user_salon_ids(auth.uid()))
    AND is_staff(auth.uid(), salon_id)
  );

-- Staff can manage orders
CREATE POLICY orders_manage_staff ON orders
  FOR ALL
  USING (
    salon_id IN (SELECT get_user_salon_ids(auth.uid()))
    AND is_staff(auth.uid(), salon_id)
  );

-- ============================================
-- PAYMENTS POLICIES
-- ============================================

-- Customers can see their own payments
CREATE POLICY payments_select_own ON payments
  FOR SELECT
  USING (
    reference_type = 'order' AND EXISTS (
      SELECT 1 FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = payments.reference_id
        AND c.profile_id = auth.uid()
    )
  );

-- Staff can see payments in their salon
CREATE POLICY payments_select_staff ON payments
  FOR SELECT
  USING (
    salon_id IN (SELECT get_user_salon_ids(auth.uid()))
    AND is_staff(auth.uid(), salon_id)
  );

-- Admin can manage payments
CREATE POLICY payments_manage_admin ON payments
  FOR ALL
  USING (
    is_admin(auth.uid(), salon_id)
  );

-- ============================================
-- VOUCHERS POLICIES
-- ============================================

-- Public: Validate voucher (limited info)
CREATE POLICY vouchers_validate_public ON vouchers
  FOR SELECT
  USING (is_active = true);

-- Staff can see all vouchers
CREATE POLICY vouchers_select_staff ON vouchers
  FOR SELECT
  USING (
    salon_id IN (SELECT get_user_salon_ids(auth.uid()))
    AND is_staff(auth.uid(), salon_id)
  );

-- Admin/Manager can manage vouchers
CREATE POLICY vouchers_manage_staff ON vouchers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE profile_id = auth.uid()
        AND salon_id = vouchers.salon_id
        AND role_name IN ('admin', 'manager')
    )
  );

-- ============================================
-- LOYALTY POLICIES
-- ============================================

-- Customers can see their own loyalty
CREATE POLICY customer_loyalty_select_own ON customer_loyalty
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_loyalty.customer_id
        AND c.profile_id = auth.uid()
    )
  );

-- Staff can see loyalty in their salon
CREATE POLICY customer_loyalty_select_staff ON customer_loyalty
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_loyalty.customer_id
        AND c.salon_id IN (SELECT get_user_salon_ids(auth.uid()))
    )
  );

-- ============================================
-- NOTIFICATION PREFERENCES POLICIES
-- ============================================

-- Users can manage their own preferences
CREATE POLICY notification_prefs_own ON notification_preferences
  FOR ALL
  USING (profile_id = auth.uid());

-- ============================================
-- CONSENT RECORDS POLICIES
-- ============================================

-- Users can see their own consent records
CREATE POLICY consent_records_select_own ON consent_records
  FOR SELECT
  USING (profile_id = auth.uid());

-- Users can manage their own consent
CREATE POLICY consent_records_manage_own ON consent_records
  FOR ALL
  USING (profile_id = auth.uid());

-- ============================================
-- DATA EXPORT REQUESTS POLICIES
-- ============================================

-- Users can see and create their own requests
CREATE POLICY data_export_requests_own ON data_export_requests
  FOR ALL
  USING (profile_id = auth.uid());

-- ============================================
-- AUDIT LOGS POLICIES
-- ============================================

-- Admin can see audit logs for their salon
CREATE POLICY audit_logs_select_admin ON audit_logs
  FOR SELECT
  USING (
    is_admin(auth.uid(), salon_id)
  );

-- No one can modify audit logs (immutable)
-- INSERT is done via SECURITY DEFINER functions

-- ============================================
-- SETTINGS POLICIES
-- ============================================

-- Public settings can be read by anyone
CREATE POLICY settings_select_public ON settings
  FOR SELECT
  USING (is_public = true);

-- Staff can see settings for their salon
CREATE POLICY settings_select_staff ON settings
  FOR SELECT
  USING (
    salon_id IN (SELECT get_user_salon_ids(auth.uid()))
  );

-- Admin can manage settings
CREATE POLICY settings_manage_admin ON settings
  FOR ALL
  USING (
    is_admin(auth.uid(), salon_id)
  );

-- ============================================
-- OPENING HOURS POLICIES
-- ============================================

-- Public: Anyone can see opening hours
CREATE POLICY opening_hours_select_public ON opening_hours
  FOR SELECT
  USING (true);

-- Admin can manage opening hours
CREATE POLICY opening_hours_manage_admin ON opening_hours
  FOR ALL
  USING (
    is_admin(auth.uid(), salon_id)
  );

-- ============================================
-- SPECIAL HOURS POLICIES
-- ============================================

-- Public: Anyone can see special hours
CREATE POLICY special_hours_select_public ON special_hours
  FOR SELECT
  USING (true);

-- Admin can manage special hours
CREATE POLICY special_hours_manage_admin ON special_hours
  FOR ALL
  USING (
    is_admin(auth.uid(), salon_id)
  );

-- ============================================
-- SERVICE ACCOUNT BYPASS
-- For backend operations via service role
-- ============================================

-- Note: When using the service role key (supabase_service_role),
-- RLS is bypassed automatically. This is used for:
-- - Cron jobs
-- - Webhook handlers
-- - Admin operations
-- - Data migrations

-- ============================================
-- HQ ROLE POLICIES
-- Cross-salon access for headquarters
-- ============================================

-- HQ can see all salons
CREATE POLICY salons_select_hq ON salons
  FOR SELECT
  USING (
    has_role(auth.uid(), 'hq')
  );

-- HQ can see all customers across salons
CREATE POLICY customers_select_hq ON customers
  FOR SELECT
  USING (
    has_role(auth.uid(), 'hq')
  );

-- HQ can see all appointments across salons
CREATE POLICY appointments_select_hq ON appointments
  FOR SELECT
  USING (
    has_role(auth.uid(), 'hq')
  );

-- HQ can see all orders across salons
CREATE POLICY orders_select_hq ON orders
  FOR SELECT
  USING (
    has_role(auth.uid(), 'hq')
  );

-- HQ can see all payments across salons
CREATE POLICY payments_select_hq ON payments
  FOR SELECT
  USING (
    has_role(auth.uid(), 'hq')
  );

-- HQ can see daily sales across salons
CREATE POLICY daily_sales_select_hq ON daily_sales
  FOR SELECT
  USING (
    has_role(auth.uid(), 'hq')
  );
