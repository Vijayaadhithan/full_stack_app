ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_fee" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_distance_km" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "free_delivery_radius_km" numeric(8, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "delivery_fee" numeric(10, 2) DEFAULT '0';
