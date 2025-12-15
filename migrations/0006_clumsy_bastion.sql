ALTER TABLE "orders" ADD COLUMN "order_type" text DEFAULT 'product_order' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "order_text" text;