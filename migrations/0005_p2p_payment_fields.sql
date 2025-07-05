-- Migration to add P2P payment support fields

ALTER TABLE users ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS upi_qr_code_url TEXT;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_reference TEXT;