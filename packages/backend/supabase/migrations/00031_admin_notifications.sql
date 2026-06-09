-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00031_admin_notifications.sql
-- Description: Admin notifications for the notification bell
-- ============================================

-- ============================================
-- ADMIN_NOTIFICATIONS TABLE
-- Notifications shown in admin panel (bell icon)
-- ============================================
CREATE TABLE admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Notification type
  type TEXT NOT NULL,
  -- Types: new_appointment, appointment_cancelled, new_order, new_customer, etc.

  -- Title and message
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Reference to related entity
  reference_type TEXT,
  reference_id UUID,

  -- Link to navigate when clicked
  link TEXT,

  -- Status
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE admin_notifications IS 'Admin panel notifications (bell icon)';
COMMENT ON COLUMN admin_notifications.type IS 'Notification type: new_appointment, appointment_cancelled, new_order, etc.';
COMMENT ON COLUMN admin_notifications.reference_type IS 'Type of related entity: appointment, order, customer';
COMMENT ON COLUMN admin_notifications.reference_id IS 'ID of the related entity';
COMMENT ON COLUMN admin_notifications.link IS 'URL path to navigate when notification is clicked';

-- Indexes
CREATE INDEX idx_admin_notifications_salon ON admin_notifications(salon_id);
CREATE INDEX idx_admin_notifications_unread ON admin_notifications(salon_id, is_read) WHERE is_read = false;
CREATE INDEX idx_admin_notifications_created ON admin_notifications(salon_id, created_at DESC);
CREATE INDEX idx_admin_notifications_reference ON admin_notifications(reference_type, reference_id);

-- ============================================
-- FUNCTION: Create admin notification
-- ============================================
CREATE OR REPLACE FUNCTION create_admin_notification(
  p_salon_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_link TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO admin_notifications (
    salon_id, type, title, message, reference_type, reference_id, link
  ) VALUES (
    p_salon_id, p_type, p_title, p_message, p_reference_type, p_reference_id, p_link
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Mark notifications as read
-- ============================================
CREATE OR REPLACE FUNCTION mark_admin_notifications_read(
  p_salon_id UUID,
  p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- Mark all as read
    UPDATE admin_notifications
    SET is_read = true, read_at = NOW()
    WHERE salon_id = p_salon_id AND is_read = false;
  ELSE
    -- Mark specific ones as read
    UPDATE admin_notifications
    SET is_read = true, read_at = NOW()
    WHERE salon_id = p_salon_id
      AND id = ANY(p_notification_ids)
      AND is_read = false;
  END IF;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-create notification on new online appointment
-- ============================================
CREATE OR REPLACE FUNCTION notify_new_appointment()
RETURNS TRIGGER AS $$
DECLARE
  service_names TEXT;
BEGIN
  -- Only notify for online bookings that are confirmed
  IF NEW.booked_online = true AND NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status != 'confirmed') THEN
    -- Get service names
    SELECT string_agg(service_name, ', ')
    INTO service_names
    FROM appointment_services
    WHERE appointment_id = NEW.id;

    -- Create admin notification
    INSERT INTO admin_notifications (
      salon_id,
      type,
      title,
      message,
      reference_type,
      reference_id,
      link
    ) VALUES (
      NEW.salon_id,
      'new_appointment',
      'Neuer Termin',
      COALESCE(NEW.customer_name, 'Kunde') || ' hat einen Termin gebucht' ||
        CASE WHEN service_names IS NOT NULL THEN ' (' || service_names || ')' ELSE '' END ||
        ' am ' || TO_CHAR(NEW.start_time AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY') ||
        ' um ' || TO_CHAR(NEW.start_time AT TIME ZONE 'Europe/Zurich', 'HH24:MI') || ' Uhr',
      'appointment',
      NEW.id,
      '/admin/kalender'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_notify_new_appointment ON appointments;
CREATE TRIGGER trigger_notify_new_appointment
  AFTER INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_appointment();

-- ============================================
-- TRIGGER: Notify on appointment cancellation
-- NOTE: This trigger is disabled - notifications are created in application code
-- to properly distinguish between customer and admin cancellations
-- ============================================
CREATE OR REPLACE FUNCTION notify_appointment_cancelled()
RETURNS TRIGGER AS $$
BEGIN
  -- Disabled: Customer cancellations create notifications via application code
  -- This prevents incorrect "customer hat storniert" message when admin cancels
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (disabled - kept for reference)
DROP TRIGGER IF EXISTS trigger_notify_appointment_cancelled ON appointments;
CREATE TRIGGER trigger_notify_appointment_cancelled
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_appointment_cancelled();

-- ============================================
-- Clean up old notifications (delete after 6 months)
-- Note: Page only shows last 30 days, but we keep data for 6 months
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_admin_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM admin_notifications
  WHERE created_at < NOW() - INTERVAL '6 months';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
