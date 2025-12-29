CREATE TABLE "phone_otp_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"otp_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
