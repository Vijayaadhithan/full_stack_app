-- Create table to link shop owners and their workers with responsibilities
CREATE TABLE IF NOT EXISTS shop_workers (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  responsibilities JSONB NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_shop_worker_user UNIQUE (worker_user_id),
  CONSTRAINT uq_shop_worker_pair UNIQUE (shop_id, worker_user_id)
);

