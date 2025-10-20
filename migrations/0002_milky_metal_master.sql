CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "returns_order_id_idx" ON "returns" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "returns_order_item_id_idx" ON "returns" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "returns_customer_id_idx" ON "returns" USING btree ("customer_id");