CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items(product_id);
CREATE INDEX IF NOT EXISTS returns_order_id_idx ON returns(order_id);
CREATE INDEX IF NOT EXISTS returns_order_item_id_idx ON returns(order_item_id);
CREATE INDEX IF NOT EXISTS returns_customer_id_idx ON returns(customer_id);
