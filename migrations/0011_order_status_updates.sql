-- Track order status changes with timestamps
CREATE TABLE IF NOT EXISTS order_status_updates (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  tracking_info TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_status_updates_order_id ON order_status_updates(order_id);
