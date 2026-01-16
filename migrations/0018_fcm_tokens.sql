-- FCM (Firebase Cloud Messaging) tokens for push notifications
-- Stores device tokens for Android and Web clients

CREATE TABLE IF NOT EXISTS fcm_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK (platform IN ('android', 'web')),
    device_info TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient lookup by user_id
CREATE INDEX IF NOT EXISTS fcm_tokens_user_id_idx ON fcm_tokens(user_id);

-- Index for token lookup (for cleanup on invalid tokens)
CREATE INDEX IF NOT EXISTS fcm_tokens_token_idx ON fcm_tokens(token);
