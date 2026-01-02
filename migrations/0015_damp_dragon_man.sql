CREATE INDEX "idx_bookings_service_date_status" ON "bookings" USING btree ("service_id","booking_date","status");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_created" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_orders_shop_status" ON "orders" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX "idx_orders_customer_date" ON "orders" USING btree ("customer_id","order_date");--> statement-breakpoint
CREATE INDEX "idx_products_shop_listing" ON "products" USING btree ("shop_id","is_deleted","is_available");