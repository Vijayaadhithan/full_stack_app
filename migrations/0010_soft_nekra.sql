ALTER TABLE "shops" ADD COLUMN "shop_address_street" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "shop_address_area" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "shop_address_city" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "shop_address_state" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "shop_address_pincode" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "shop_location_lat" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "shop_location_lng" numeric(10, 7);