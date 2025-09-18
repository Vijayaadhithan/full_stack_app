-- Email notification preference overrides to control outbound email volume
CREATE TABLE IF NOT EXISTS email_notification_preferences (
  id SERIAL PRIMARY KEY,
  notification_type TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT email_notification_pref_unique UNIQUE (notification_type, recipient_type)
);
