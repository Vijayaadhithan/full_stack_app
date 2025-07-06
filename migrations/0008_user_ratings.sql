-- Add columns for tracking provider ratings
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS average_rating DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;