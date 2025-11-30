ALTER TABLE "bookings" ADD COLUMN "time_slot_label" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "is_available_now" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "availability_note" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "allowed_slots" jsonb DEFAULT '["morning","afternoon","evening"]'::jsonb;--> statement-breakpoint
CREATE INDEX "idx_bookings_time_slot_label" ON "bookings" USING btree ("time_slot_label");--> statement-breakpoint
CREATE INDEX "idx_services_is_available_now" ON "services" USING btree ("is_available_now");