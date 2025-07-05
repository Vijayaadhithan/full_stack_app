-- Remove columns related to the old payment flow
ALTER TABLE bookings DROP COLUMN IF EXISTS razorpay_order_id;
ALTER TABLE bookings DROP COLUMN IF EXISTS razorpay_payment_id;
ALTER TABLE orders DROP COLUMN IF EXISTS razorpay_order_id;
ALTER TABLE orders DROP COLUMN IF EXISTS razorpay_payment_id;
ALTER TABLE users DROP COLUMN IF EXISTS razorpay_linked_account_id;
ALTER TABLE bookings ALTER COLUMN payment_status DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN payment_status DROP NOT NULL;