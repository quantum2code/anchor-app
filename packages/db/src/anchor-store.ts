import { and, asc, eq } from "drizzle-orm";

import { db } from "./index";
import { anchor } from "./schema/index";

type CreateAnchorInput = {
  documentId: string;
  ownerId: string;
  quote: string;
  summary: string;
  content: string;
  pageStart: number;
  pageEnd: number;
};

type UpdateAnchorInput = {
  id: string;
  ownerId: string;
  quote: string;
  summary: string;
  content: string;
  pageStart: number;
  pageEnd: number;
};

type GetAnchorByIdInput = {
  id: string;
  ownerId: string;
};

type ListAnchorsByPageRangeInput = {
  documentId: string;
  ownerId: string;
  startPage: number;
  endPage: number;
};

type DeleteAnchorInput = {
  id: string;
  ownerId: string;
};

export function createDatabaseAnchorStore() {
  return {
    async create(input: CreateAnchorInput) {
      const [createdAnchor] = await db
        .insert(anchor)
        .values({
          id: crypto.randomUUID(),
          documentId: input.documentId,
          ownerId: input.ownerId,
          quote: input.quote,
          summary: input.summary,
          content: input.content,
          pageStart: input.pageStart,
          pageEnd: input.pageEnd,
        })
        .returning();

      if (!createdAnchor) {
        throw new Error("Anchor creation failed");
      }

      return createdAnchor;
    },
    async getById({ id, ownerId }: GetAnchorByIdInput) {
      const storedAnchor = await db.query.anchor.findFirst({
        where: (anchors, { and, eq: columnEquals }) =>
          and(columnEquals(anchors.id, id), columnEquals(anchors.ownerId, ownerId)),
      });

      return storedAnchor ?? null;
    },
    async listByPageRange({
      documentId,
      ownerId,
      startPage,
      endPage,
    }: ListAnchorsByPageRangeInput) {
      const storedAnchors = await db.query.anchor.findMany({
        where: (anchors, { and, eq: columnEquals, gte: columnGte, lte: columnLte }) =>
          and(
            columnEquals(anchors.documentId, documentId),
            columnEquals(anchors.ownerId, ownerId),
            columnLte(anchors.pageStart, endPage),
            columnGte(anchors.pageEnd, startPage),
          ),
        orderBy: [asc(anchor.pageStart), asc(anchor.createdAt)],
      });

      return storedAnchors.map(({ content: _content, ...summary }) => summary);
    },
    async update(input: UpdateAnchorInput) {
      const [updatedAnchor] = await db
        .update(anchor)
        .set({
          quote: input.quote,
          summary: input.summary,
          content: input.content,
          pageStart: input.pageStart,
          pageEnd: input.pageEnd,
          updatedAt: new Date(),
        })
        .where(and(eq(anchor.id, input.id), eq(anchor.ownerId, input.ownerId)))
        .returning();

      return updatedAnchor ?? null;
    },
    async delete({ id, ownerId }: DeleteAnchorInput) {
      const [deletedAnchor] = await db
        .delete(anchor)
        .where(and(eq(anchor.id, id), eq(anchor.ownerId, ownerId)))
        .returning();

      return deletedAnchor ?? null;
    },
  };
}
