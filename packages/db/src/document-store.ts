import { and, eq } from "drizzle-orm";

import { db } from "./index";
import { document } from "./schema/index";

type DocumentStatus = "uploading" | "processing" | "ready" | "failed";
type CreateDocumentInput = {
  projectId: string;
  ownerId: string;
  name: string;
  storagePath: string;
  pageCount?: number | null;
};
type ListByProjectInput = {
  projectId: string;
  ownerId: string;
};
type GetDocumentByIdInput = {
  id: string;
  ownerId: string;
};
type UpdateDocumentStatusInput = {
  id: string;
  ownerId: string;
  status: DocumentStatus;
  pageCount?: number | null;
};

export function createDatabaseDocumentStore() {
  return {
    async create(input: CreateDocumentInput) {
      const [createdDocument] = await db
        .insert(document)
        .values({
          id: crypto.randomUUID(),
          projectId: input.projectId,
          ownerId: input.ownerId,
          name: input.name,
          storagePath: input.storagePath,
          mimeType: "application/pdf",
          status: "uploading",
          pageCount: input.pageCount ?? null,
        })
        .returning();

      if (!createdDocument) {
        throw new Error("Document creation failed");
      }

      return createdDocument;
    },
    async getById({ id, ownerId }: GetDocumentByIdInput) {
      const storedDocument = await db.query.document.findFirst({
        where: (documents, { and, eq: columnEquals }) =>
          and(columnEquals(documents.id, id), columnEquals(documents.ownerId, ownerId)),
      });

      return storedDocument ?? null;
    },
    async listByProject({ projectId, ownerId }: ListByProjectInput) {
      const documents = await db.query.document.findMany({
        where: (documents, { and, eq: columnEquals }) =>
          and(
            columnEquals(documents.projectId, projectId),
            columnEquals(documents.ownerId, ownerId),
          ),
      });

      return documents.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    },
    async updateStatus({ id, ownerId, status, pageCount }: UpdateDocumentStatusInput) {
      const updateValues: {
        status: DocumentStatus;
        updatedAt: Date;
        pageCount?: number | null;
      } = {
        status,
        updatedAt: new Date(),
      };

      if (pageCount !== undefined) {
        updateValues.pageCount = pageCount;
      }

      const [updatedDocument] = await db
        .update(document)
        .set(updateValues)
        .where(and(eq(document.id, id), eq(document.ownerId, ownerId)))
        .returning();

      return updatedDocument ?? null;
    },
  };
}
