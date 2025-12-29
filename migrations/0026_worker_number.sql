-- Migration: Add worker_number column for shop worker login
-- This allows workers to login with a 10-digit custom ID + 4-digit PIN

ALTER TABLE users ADD COLUMN IF NOT EXISTS worker_number TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_worker_number ON users(worker_number);
