CREATE INDEX "reviews_service_id_idx" ON "reviews" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "reviews_customer_id_idx" ON "reviews" USING btree ("customer_id");