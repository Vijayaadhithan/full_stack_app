-- Add delivery and pickup availability fields for shops
ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_available BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pickup_available BOOLEAN DEFAULT TRUE;

-- Support delivery method and new payment status for orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE orders ALTER COLUMN payment_status SET DEFAULT 'pending';