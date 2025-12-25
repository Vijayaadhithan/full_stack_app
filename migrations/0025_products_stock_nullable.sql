-- Allow products.stock to be NULL so shops can track availability without exact counts.
ALTER TABLE products
  ALTER COLUMN stock DROP NOT NULL;

