-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00012_system.sql
-- Description: Audit logs, settings, system tables
-- ============================================

-- ============================================
-- AUDIT_LOGS TABLE
-- Comprehensive audit trail
-- ============================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE SET NULL,

  -- Who performed the action
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_role role_name,

  -- What was done
  action audit_action_type NOT NULL,

  -- Target entity
  entity_type TEXT NOT NULL,
  entity_id UUID,

  -- Details
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}',

  -- Context
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'System-wide audit trail';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous state before change';
COMMENT ON COLUMN audit_logs.new_values IS 'New state after change';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context data';

-- Indexes
CREATE INDEX idx_audit_logs_salon ON audit_logs(salon_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_salon_date ON audit_logs(salon_id, created_at DESC);

-- ============================================
-- SETTINGS TABLE
-- Global application settings
-- ============================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,

  -- Setting identification
  key TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',

  -- Value
  value JSONB NOT NULL,
  value_type TEXT DEFAULT 'string',
  -- Types: string, number, boolean, json

  -- Description
  description TEXT,

  -- Access control
  is_public BOOLEAN DEFAULT false,
  is_editable BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_setting_key UNIQUE (salon_id, key)
);

COMMENT ON TABLE settings IS 'Application settings';
COMMENT ON COLUMN settings.key IS 'Setting identifier';
COMMENT ON COLUMN settings.is_public IS 'Whether visible without auth';

-- Indexes
CREATE INDEX idx_settings_salon ON settings(salon_id);
CREATE INDEX idx_settings_key ON settings(key);
CREATE INDEX idx_settings_category ON settings(category);

-- Apply updated_at trigger
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FEATURE_FLAGS TABLE
-- Feature toggles per salon
-- ============================================
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,

  -- Flag identification
  flag_key TEXT NOT NULL,

  -- Status
  is_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Rollout configuration
  rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),

  -- User targeting
  enabled_for_users UUID[] DEFAULT '{}',
  disabled_for_users UUID[] DEFAULT '{}',

  -- Metadata
  description TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_feature_flag UNIQUE (salon_id, flag_key)
);

COMMENT ON TABLE feature_flags IS 'Feature flag configuration';
COMMENT ON COLUMN feature_flags.rollout_percentage IS 'Percentage of users who see feature';

-- Indexes
CREATE INDEX idx_feature_flags_salon ON feature_flags(salon_id);
CREATE INDEX idx_feature_flags_key ON feature_flags(flag_key);

-- Apply updated_at trigger
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- OPENING_HOURS TABLE
-- Salon operating hours
-- ============================================
CREATE TABLE opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Day (0 = Monday, 6 = Sunday)
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),

  -- Times
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,

  -- Whether open on this day
  is_open BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_opening_hours UNIQUE (salon_id, day_of_week),
  CONSTRAINT valid_hours CHECK (close_time > open_time)
);

COMMENT ON TABLE opening_hours IS 'Regular salon opening hours';

-- Indexes
CREATE INDEX idx_opening_hours_salon ON opening_hours(salon_id);

-- Apply updated_at trigger
CREATE TRIGGER update_opening_hours_updated_at
  BEFORE UPDATE ON opening_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SPECIAL_HOURS TABLE
-- Exceptions to regular hours (holidays, special days)
-- ============================================
CREATE TABLE special_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Date
  date DATE NOT NULL,

  -- Override hours (NULL means closed)
  open_time TIME,
  close_time TIME,

  -- Whether open
  is_open BOOLEAN NOT NULL DEFAULT false,

  -- Reason
  reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_special_hours UNIQUE (salon_id, date)
);

COMMENT ON TABLE special_hours IS 'Special hours exceptions';

-- Indexes
CREATE INDEX idx_special_hours_salon ON special_hours(salon_id);
CREATE INDEX idx_special_hours_date ON special_hours(salon_id, date);

-- ============================================
-- INTEGRATIONS TABLE
-- External service integrations
-- ============================================
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Integration type
  integration_type TEXT NOT NULL,
  -- Types: google_calendar, google_reviews, instagram, facebook

  -- Status
  is_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Credentials (encrypted in practice)
  credentials JSONB DEFAULT '{}',

  -- Configuration
  config JSONB DEFAULT '{}',

  -- Sync status
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_integration UNIQUE (salon_id, integration_type)
);

COMMENT ON TABLE integrations IS 'External service integrations';
COMMENT ON COLUMN integrations.credentials IS 'API keys/tokens (should be encrypted)';

-- Indexes
CREATE INDEX idx_integrations_salon ON integrations(salon_id);
CREATE INDEX idx_integrations_type ON integrations(integration_type);

-- Apply updated_at trigger
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CRON_JOBS TABLE
-- Track scheduled job executions
-- ============================================
CREATE TABLE cron_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job identification
  job_name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  -- Types: cleanup_reservations, send_reminders, sync_calendar, aggregate_sales

  -- Schedule (cron expression)
  schedule TEXT NOT NULL,

  -- Status
  is_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Last execution
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_duration_ms INTEGER,
  last_run_error TEXT,

  -- Next scheduled run
  next_run_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_cron_job UNIQUE (job_name)
);

COMMENT ON TABLE cron_jobs IS 'Scheduled job configuration and status';

-- Indexes
CREATE INDEX idx_cron_jobs_next_run ON cron_jobs(next_run_at) WHERE is_enabled = true;

-- Apply updated_at trigger
CREATE TRIGGER update_cron_jobs_updated_at
  BEFORE UPDATE ON cron_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Log audit event
-- ============================================
CREATE OR REPLACE FUNCTION log_audit(
  p_salon_id UUID,
  p_actor_id UUID,
  p_action audit_action_type,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_log_id UUID;
  actor_email TEXT;
  actor_role role_name;
BEGIN
  -- Get actor info
  IF p_actor_id IS NOT NULL THEN
    SELECT email INTO actor_email FROM profiles WHERE id = p_actor_id;
    SELECT role_name INTO actor_role
    FROM user_roles
    WHERE profile_id = p_actor_id
      AND (salon_id = p_salon_id OR salon_id IS NULL)
    LIMIT 1;
  END IF;

  -- Insert log
  INSERT INTO audit_logs (
    salon_id, actor_id, actor_email, actor_role,
    action, entity_type, entity_id,
    old_values, new_values, metadata,
    ip_address, user_agent
  ) VALUES (
    p_salon_id, p_actor_id, actor_email, actor_role,
    p_action, p_entity_type, p_entity_id,
    p_old_values, p_new_values, p_metadata,
    p_ip_address, p_user_agent
  )
  RETURNING id INTO new_log_id;

  RETURN new_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Get setting value
-- ============================================
CREATE OR REPLACE FUNCTION get_setting(
  p_key TEXT,
  p_salon_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
  SELECT value
  FROM settings
  WHERE key = p_key
    AND (salon_id = p_salon_id OR (p_salon_id IS NULL AND salon_id IS NULL))
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- ============================================
-- FUNCTION: Set setting value
-- ============================================
CREATE OR REPLACE FUNCTION set_setting(
  p_key TEXT,
  p_value JSONB,
  p_salon_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT 'general',
  p_description TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO settings (salon_id, key, value, category, description)
  VALUES (p_salon_id, p_key, p_value, p_category, p_description)
  ON CONFLICT (salon_id, key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Check feature flag
-- ============================================
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_flag_key TEXT,
  p_salon_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  flag_record RECORD;
BEGIN
  SELECT * INTO flag_record
  FROM feature_flags
  WHERE flag_key = p_flag_key
    AND (salon_id = p_salon_id OR salon_id IS NULL);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT flag_record.is_enabled THEN
    RETURN false;
  END IF;

  -- Check user-specific overrides
  IF p_user_id IS NOT NULL THEN
    IF p_user_id = ANY(flag_record.disabled_for_users) THEN
      RETURN false;
    END IF;
    IF p_user_id = ANY(flag_record.enabled_for_users) THEN
      RETURN true;
    END IF;
  END IF;

  -- Check rollout percentage
  IF flag_record.rollout_percentage < 100 THEN
    -- Simple hash-based rollout
    RETURN (ABS(HASHTEXT(COALESCE(p_user_id::TEXT, p_salon_id::TEXT, ''))) % 100) < flag_record.rollout_percentage;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION: Get salon opening hours for date
-- ============================================
CREATE OR REPLACE FUNCTION get_salon_hours_for_date(
  p_salon_id UUID,
  p_date DATE
)
RETURNS TABLE (
  is_open BOOLEAN,
  open_time TIME,
  close_time TIME,
  is_special BOOLEAN,
  reason TEXT
) AS $$
DECLARE
  special RECORD;
  regular RECORD;
  day_num INTEGER;
BEGIN
  -- Check special hours first
  SELECT * INTO special
  FROM special_hours
  WHERE salon_id = p_salon_id AND date = p_date;

  IF FOUND THEN
    is_open := special.is_open;
    open_time := special.open_time;
    close_time := special.close_time;
    is_special := true;
    reason := special.reason;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Get regular hours
  day_num := EXTRACT(DOW FROM p_date)::INTEGER;
  -- Convert from Sunday=0 to Monday=0
  day_num := CASE WHEN day_num = 0 THEN 6 ELSE day_num - 1 END;

  SELECT * INTO regular
  FROM opening_hours
  WHERE salon_id = p_salon_id AND day_of_week = day_num;

  IF FOUND THEN
    is_open := regular.is_open;
    open_time := regular.open_time;
    close_time := regular.close_time;
    is_special := false;
    reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- No hours defined - default closed
  is_open := false;
  open_time := NULL;
  close_time := NULL;
  is_special := false;
  reason := NULL;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- VIEW: Recent audit logs
-- ============================================
CREATE VIEW v_recent_audit_logs AS
SELECT
  al.*,
  p.first_name || ' ' || p.last_name AS actor_name
FROM audit_logs al
LEFT JOIN profiles p ON al.actor_id = p.id
WHERE al.created_at >= NOW() - INTERVAL '7 days'
ORDER BY al.created_at DESC;

COMMENT ON VIEW v_recent_audit_logs IS 'Recent audit activity';

-- ============================================
-- Insert default cron jobs
-- ============================================
INSERT INTO cron_jobs (job_name, job_type, schedule) VALUES
  ('cleanup_expired_reservations', 'cleanup_reservations', '*/5 * * * *'),
  ('send_appointment_reminders', 'send_reminders', '0 * * * *'),
  ('aggregate_daily_sales', 'aggregate_sales', '0 1 * * *'),
  ('apply_data_retention', 'data_retention', '0 3 * * 0')
ON CONFLICT (job_name) DO NOTHING;
