CREATE TABLE IF NOT EXISTS magic_link_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS magic_link_tokens_token_hash_idx
    ON magic_link_tokens (token_hash);

CREATE INDEX IF NOT EXISTS magic_link_tokens_user_id_idx
    ON magic_link_tokens (user_id);
