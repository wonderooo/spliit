ALTER TABLE "settlements" ADD COLUMN "created_by" text;--> statement-breakpoint
UPDATE "settlements" SET "created_by" = "from_user_id";--> statement-breakpoint
ALTER TABLE "settlements" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
