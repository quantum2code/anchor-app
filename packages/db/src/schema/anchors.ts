import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { document } from "./documents";

export const anchor = pgTable(
  "anchor",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull(),
    quote: text("quote").notNull(),
    summary: text("summary").notNull(),
    content: text("content").notNull(),
    pageStart: integer("page_start").notNull(),
    pageEnd: integer("page_end").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("anchor_document_id_idx").on(table.documentId),
    index("anchor_owner_id_idx").on(table.ownerId),
    index("anchor_document_page_range_idx").on(table.documentId, table.pageStart, table.pageEnd),
  ],
);

export const documentAnchorRelations = relations(document, ({ many }) => ({
  anchors: many(anchor),
}));

export const anchorDocumentRelations = relations(anchor, ({ one }) => ({
  document: one(document, {
    fields: [anchor.documentId],
    references: [document.id],
  }),
}));
