import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { project } from "./projects";

export const documentStatusValues = ["uploading", "processing", "ready", "failed"] as const;

export const document = pgTable(
  "document",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    status: text("status", { enum: documentStatusValues }).notNull(),
    pageCount: integer("page_count"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("document_project_id_idx").on(table.projectId),
    index("document_owner_id_idx").on(table.ownerId),
  ],
);

export const projectRelations = relations(project, ({ many }) => ({
  documents: many(document),
}));

export const documentRelations = relations(document, ({ one }) => ({
  project: one(project, {
    fields: [document.projectId],
    references: [project.id],
  }),
}));
