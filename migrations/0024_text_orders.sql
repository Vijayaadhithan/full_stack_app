-- Support "Quick Order" / text-based orders that do not map to product IDs initially
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'product_order';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_text text;

CREATE INDEX IF NOT EXISTS orders_order_type_idx ON orders(order_type);
