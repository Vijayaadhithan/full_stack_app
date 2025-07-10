-- Add returnsEnabled column to users for configurable return policy
ALTER TABLE users ADD COLUMN IF NOT EXISTS returns_enabled BOOLEAN DEFAULT TRUE;

-- Create product_reviews table to store customer feedback on products
CREATE TABLE IF NOT EXISTS product_reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  customer_id INTEGER REFERENCES users(id),
  order_id INTEGER REFERENCES orders(id),
  rating INTEGER NOT NULL,
  review TEXT,
  images TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  shop_reply TEXT,
  replied_at TIMESTAMP,
  is_verified_purchase BOOLEAN DEFAULT FALSE