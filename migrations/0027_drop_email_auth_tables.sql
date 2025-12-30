-- Drop email auth token tables (no longer needed - using phone OTP auth)
-- This migration is safe to run - these tables were used for:
-- - email_verification_tokens: Email verification links
-- - magic_link_tokens: Passwordless login via email
-- - password_reset_tokens: Email-based password reset

DROP TABLE IF EXISTS email_verification_tokens CASCADE;
DROP TABLE IF EXISTS magic_link_tokens CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
