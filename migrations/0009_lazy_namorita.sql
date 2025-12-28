CREATE TABLE "providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"skills" text[],
	"bio" text,
	"experience" text,
	"qualifications" text,
	"is_on_duty" boolean DEFAULT false,
	"languages" text[],
	"specializations" text[],
	"certifications" text[],
	"working_hours" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "providers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"shop_name" text NOT NULL,
	"description" text,
	"business_type" text,
	"gstin" text,
	"is_open" boolean DEFAULT true,
	"catalog_mode_enabled" boolean DEFAULT false,
	"open_order_mode" boolean DEFAULT false,
	"allow_pay_later" boolean DEFAULT false,
	"pay_later_whitelist" jsonb,
	"working_hours" jsonb,
	"shipping_policy" text,
	"return_policy" text,
	"banner_image_url" text,
	"logo_image_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "shops_owner_id_unique" UNIQUE("owner_id")
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "language" SET DEFAULT 'ta';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pin" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_phone_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "providers_user_id_idx" ON "providers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shops_owner_id_idx" ON "shops" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_unique" UNIQUE("phone");