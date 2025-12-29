ALTER TABLE "users" ADD COLUMN "worker_number" text;--> statement-breakpoint
CREATE INDEX "users_worker_number_idx" ON "users" USING btree ("worker_number");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_worker_number_unique" UNIQUE("worker_number");