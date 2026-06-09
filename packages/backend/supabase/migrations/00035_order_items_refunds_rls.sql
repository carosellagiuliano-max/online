-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00035_order_items_refunds_rls.sql
-- Description: Add missing RLS policies for order_items and refunds tables
-- ============================================

-- ============================================
-- ORDER_ITEMS RLS POLICIES
-- ============================================

-- RLS is already enabled on order_items (from 00014)
-- But no policies exist, so all access is blocked

-- Customers can view their own order items
CREATE POLICY "Customers can view own order items"
ON order_items FOR SELECT
USING (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE o.customer_id IN (
      SELECT c.id FROM customers c
      WHERE c.profile_id = auth.uid()
    )
  )
);

-- Staff can view order items in their salon
CREATE POLICY "Staff can view order items"
ON order_items FOR SELECT
USING (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE o.salon_id IN (
      SELECT ur.salon_id FROM user_roles ur
      WHERE ur.profile_id = auth.uid()
      AND ur.role_name IN ('admin', 'manager', 'mitarbeiter')
    )
  )
);

-- Staff can manage order items
CREATE POLICY "Staff can manage order items"
ON order_items FOR ALL
USING (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE o.salon_id IN (
      SELECT ur.salon_id FROM user_roles ur
      WHERE ur.profile_id = auth.uid()
      AND ur.role_name IN ('admin', 'manager', 'mitarbeiter')
    )
  )
);

-- Service role has full access
CREATE POLICY "Service role full access order_items"
ON order_items FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- HQ can view all order items
CREATE POLICY "HQ can view order items"
ON order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.profile_id = auth.uid()
    AND ur.role_name = 'hq'
  )
);

-- ============================================
-- REFUNDS RLS POLICIES
-- ============================================

-- RLS is already enabled on refunds (from 00014)
-- But no policies exist, so all access is blocked

-- Staff can view refunds in their salon
CREATE POLICY "Staff can view refunds"
ON refunds FOR SELECT
USING (
  salon_id IN (
    SELECT ur.salon_id FROM user_roles ur
    WHERE ur.profile_id = auth.uid()
    AND ur.role_name IN ('admin', 'manager', 'mitarbeiter')
  )
);

-- Admin/Manager can manage refunds
CREATE POLICY "Admin can manage refunds"
ON refunds FOR ALL
USING (
  salon_id IN (
    SELECT ur.salon_id FROM user_roles ur
    WHERE ur.profile_id = auth.uid()
    AND ur.role_name IN ('admin', 'manager')
  )
);

-- Service role has full access
CREATE POLICY "Service role full access refunds"
ON refunds FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- HQ can view all refunds
CREATE POLICY "HQ can view refunds"
ON refunds FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.profile_id = auth.uid()
    AND ur.role_name = 'hq'
  )
);
