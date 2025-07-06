-- Add disputed status and dispute_reason column
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

-- Update status constraint if using CHECK, assume using simple text field; no enumerations here
-- Applications should handle allowed values