-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00010_notifications.sql
-- Description: Notifications, email templates, notification preferences
-- ============================================

-- ============================================
-- NOTIFICATION_TEMPLATES TABLE
-- Email/SMS templates per salon
-- ============================================
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Template Info
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  -- Codes: appointment_confirmation, appointment_reminder, appointment_cancelled,
  --        order_confirmation, order_shipped, voucher_received, birthday_greeting,
  --        welcome, password_reset

  -- Channel
  channel notification_channel NOT NULL DEFAULT 'email',

  -- Email template
  subject TEXT,
  body_html TEXT,
  body_text TEXT,

  -- SMS template (shorter)
  sms_body TEXT,

  -- Variables available in template
  -- Stored as reference, e.g., ["customer_name", "appointment_date", "salon_name"]
  available_variables JSONB DEFAULT '[]',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_template_code_per_salon_channel UNIQUE (salon_id, code, channel)
);

COMMENT ON TABLE notification_templates IS 'Customizable notification templates';
COMMENT ON COLUMN notification_templates.code IS 'Template identifier';
COMMENT ON COLUMN notification_templates.available_variables IS 'Variables that can be used in template';

-- Indexes
CREATE INDEX idx_notification_templates_salon ON notification_templates(salon_id);
CREATE INDEX idx_notification_templates_code ON notification_templates(salon_id, code);

-- Apply updated_at trigger
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTIFICATION_PREFERENCES TABLE
-- Customer notification preferences
-- ============================================
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Preferences per category
  appointment_reminders BOOLEAN DEFAULT true,
  appointment_reminders_channel notification_channel DEFAULT 'email',

  marketing_emails BOOLEAN DEFAULT false,
  marketing_sms BOOLEAN DEFAULT false,

  order_updates BOOLEAN DEFAULT true,
  order_updates_channel notification_channel DEFAULT 'email',

  loyalty_updates BOOLEAN DEFAULT true,

  -- Reminder timing
  reminder_hours_before INTEGER DEFAULT 24,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_notification_prefs_per_profile UNIQUE (profile_id)
);

COMMENT ON TABLE notification_preferences IS 'User notification preferences';
COMMENT ON COLUMN notification_preferences.reminder_hours_before IS 'Hours before appointment to send reminder';

-- Indexes
CREATE INDEX idx_notification_prefs_profile ON notification_preferences(profile_id);

-- Apply updated_at trigger
CREATE TRIGGER update_notification_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTIFICATIONS TABLE
-- Sent/queued notifications
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Template used
  template_id UUID REFERENCES notification_templates(id),
  template_code TEXT,

  -- Channel and recipient
  channel notification_channel NOT NULL,
  recipient_email TEXT,
  recipient_phone TEXT,

  -- Content (rendered)
  subject TEXT,
  body_html TEXT,
  body_text TEXT,

  -- Reference to related entity
  reference_type TEXT,
  reference_id UUID,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  -- Status: pending, sending, sent, failed, bounced

  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- External IDs
  external_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'Notification log and queue';
COMMENT ON COLUMN notifications.status IS 'Delivery status: pending, sending, sent, failed, bounced';
COMMENT ON COLUMN notifications.external_id IS 'ID from email/SMS provider';

-- Indexes
CREATE INDEX idx_notifications_salon ON notifications(salon_id);
CREATE INDEX idx_notifications_profile ON notifications(profile_id);
CREATE INDEX idx_notifications_status ON notifications(status) WHERE status IN ('pending', 'sending');
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_notifications_reference ON notifications(reference_type, reference_id);

-- ============================================
-- SCHEDULED_REMINDERS TABLE
-- Track scheduled appointment reminders
-- ============================================
CREATE TABLE scheduled_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,

  -- Reminder details
  reminder_type TEXT NOT NULL DEFAULT 'appointment_reminder',
  scheduled_for TIMESTAMPTZ NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled',
  -- Status: scheduled, sent, cancelled, skipped

  -- Result
  notification_id UUID REFERENCES notifications(id),
  processed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_reminder_per_appointment_type UNIQUE (appointment_id, reminder_type)
);

COMMENT ON TABLE scheduled_reminders IS 'Scheduled appointment reminders';

-- Indexes
CREATE INDEX idx_scheduled_reminders_appointment ON scheduled_reminders(appointment_id);
CREATE INDEX idx_scheduled_reminders_scheduled ON scheduled_reminders(scheduled_for)
  WHERE status = 'scheduled';

-- ============================================
-- FUNCTION: Create notification from template
-- ============================================
CREATE OR REPLACE FUNCTION create_notification_from_template(
  p_salon_id UUID,
  p_profile_id UUID,
  p_template_code TEXT,
  p_channel notification_channel,
  p_variables JSONB DEFAULT '{}',
  p_scheduled_for TIMESTAMPTZ DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  template_record RECORD;
  profile_record RECORD;
  new_notification_id UUID;
  rendered_subject TEXT;
  rendered_body_html TEXT;
  rendered_body_text TEXT;
  recipient_email TEXT;
  recipient_phone TEXT;
  var_key TEXT;
  var_value TEXT;
BEGIN
  -- Get template
  SELECT * INTO template_record
  FROM notification_templates
  WHERE salon_id = p_salon_id
    AND code = p_template_code
    AND channel = p_channel
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found: %', p_template_code;
  END IF;

  -- Get profile for recipient info
  SELECT * INTO profile_record FROM profiles WHERE id = p_profile_id;

  recipient_email := profile_record.email;
  recipient_phone := profile_record.phone;

  -- Render template (simple variable replacement)
  rendered_subject := template_record.subject;
  rendered_body_html := template_record.body_html;
  rendered_body_text := COALESCE(template_record.body_text, template_record.sms_body);

  FOR var_key, var_value IN SELECT * FROM jsonb_each_text(p_variables)
  LOOP
    rendered_subject := REPLACE(rendered_subject, '{{' || var_key || '}}', var_value);
    rendered_body_html := REPLACE(rendered_body_html, '{{' || var_key || '}}', var_value);
    rendered_body_text := REPLACE(rendered_body_text, '{{' || var_key || '}}', var_value);
  END LOOP;

  -- Create notification
  INSERT INTO notifications (
    salon_id, profile_id, template_id, template_code,
    channel, recipient_email, recipient_phone,
    subject, body_html, body_text,
    reference_type, reference_id,
    scheduled_for, status
  ) VALUES (
    p_salon_id, p_profile_id, template_record.id, p_template_code,
    p_channel, recipient_email, recipient_phone,
    rendered_subject, rendered_body_html, rendered_body_text,
    p_reference_type, p_reference_id,
    p_scheduled_for, CASE WHEN p_scheduled_for IS NULL THEN 'pending' ELSE 'scheduled' END
  )
  RETURNING id INTO new_notification_id;

  RETURN new_notification_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Schedule appointment reminder
-- ============================================
CREATE OR REPLACE FUNCTION schedule_appointment_reminder(
  p_appointment_id UUID
)
RETURNS UUID AS $$
DECLARE
  appt_record RECORD;
  customer_record RECORD;
  prefs_record RECORD;
  reminder_time TIMESTAMPTZ;
  new_reminder_id UUID;
BEGIN
  -- Get appointment
  SELECT * INTO appt_record
  FROM appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  -- Get customer
  SELECT c.*, p.id AS profile_id INTO customer_record
  FROM customers c
  JOIN profiles p ON c.profile_id = p.id
  WHERE c.id = appt_record.customer_id;

  -- Get notification preferences
  SELECT * INTO prefs_record
  FROM notification_preferences
  WHERE profile_id = customer_record.profile_id;

  -- Default to 24 hours if no preference
  IF NOT FOUND OR NOT prefs_record.appointment_reminders THEN
    RETURN NULL;
  END IF;

  -- Calculate reminder time
  reminder_time := appt_record.start_time - (COALESCE(prefs_record.reminder_hours_before, 24) || ' hours')::INTERVAL;

  -- Don't schedule if already passed
  IF reminder_time <= NOW() THEN
    RETURN NULL;
  END IF;

  -- Create scheduled reminder
  INSERT INTO scheduled_reminders (
    appointment_id, reminder_type, scheduled_for
  ) VALUES (
    p_appointment_id, 'appointment_reminder', reminder_time
  )
  ON CONFLICT (appointment_id, reminder_type) DO UPDATE
  SET scheduled_for = reminder_time, status = 'scheduled'
  RETURNING id INTO new_reminder_id;

  RETURN new_reminder_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Process scheduled reminders
-- (Called by cron job)
-- ============================================
CREATE OR REPLACE FUNCTION process_scheduled_reminders()
RETURNS INTEGER AS $$
DECLARE
  reminder RECORD;
  processed_count INTEGER := 0;
  notification_id UUID;
  appt RECORD;
  customer RECORD;
  variables JSONB;
BEGIN
  FOR reminder IN
    SELECT sr.*, a.salon_id, a.start_time, a.customer_id, a.staff_id
    FROM scheduled_reminders sr
    JOIN appointments a ON sr.appointment_id = a.id
    WHERE sr.status = 'scheduled'
      AND sr.scheduled_for <= NOW()
      AND a.status = 'confirmed'
    FOR UPDATE OF sr SKIP LOCKED
  LOOP
    -- Get customer
    SELECT c.*, p.email, p.phone
    INTO customer
    FROM customers c
    JOIN profiles p ON c.profile_id = p.id
    WHERE c.id = reminder.customer_id;

    -- Build variables
    variables := jsonb_build_object(
      'customer_name', customer.first_name,
      'appointment_date', TO_CHAR(reminder.start_time AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY'),
      'appointment_time', TO_CHAR(reminder.start_time AT TIME ZONE 'Europe/Zurich', 'HH24:MI')
    );

    -- Create notification
    notification_id := create_notification_from_template(
      reminder.salon_id,
      customer.profile_id,
      'appointment_reminder',
      'email',
      variables,
      NULL,
      'appointment',
      reminder.appointment_id
    );

    -- Update reminder
    UPDATE scheduled_reminders
    SET status = 'sent', notification_id = notification_id, processed_at = NOW()
    WHERE id = reminder.id;

    processed_count := processed_count + 1;
  END LOOP;

  RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Cancel scheduled reminders for appointment
-- ============================================
CREATE OR REPLACE FUNCTION cancel_appointment_reminders(p_appointment_id UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE scheduled_reminders
  SET status = 'cancelled'
  WHERE appointment_id = p_appointment_id
    AND status = 'scheduled';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Pending notifications
-- ============================================
CREATE VIEW v_pending_notifications AS
SELECT
  n.*,
  p.first_name || ' ' || p.last_name AS recipient_name
FROM notifications n
LEFT JOIN profiles p ON n.profile_id = p.id
WHERE n.status = 'pending'
  OR (n.status = 'scheduled' AND n.scheduled_for <= NOW())
ORDER BY COALESCE(n.scheduled_for, n.created_at);

COMMENT ON VIEW v_pending_notifications IS 'Notifications ready to be sent';

-- ============================================
-- VIEW: Notification statistics
-- ============================================
CREATE VIEW v_notification_stats AS
SELECT
  salon_id,
  DATE(created_at) AS date,
  channel,
  status,
  COUNT(*) AS count
FROM notifications
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY salon_id, DATE(created_at), channel, status;

COMMENT ON VIEW v_notification_stats IS 'Notification delivery statistics';
