CREATE TABLE "anchor" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"quote" text NOT NULL,
	"summary" text NOT NULL,
	"content" text NOT NULL,
	"page_start" integer NOT NULL,
	"page_end" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anchor" ADD CONSTRAINT "anchor_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anchor_document_id_idx" ON "anchor" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "anchor_owner_id_idx" ON "anchor" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "anchor_document_page_range_idx" ON "anchor" USING btree ("document_id","page_start","page_end");