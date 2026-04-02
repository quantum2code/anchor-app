export type DocumentStatus = "uploading" | "processing" | "ready" | "failed";

export type Document = {
  id: string;
  projectId: string;
  ownerId: string;
  name: string;
  storagePath: string;
  mimeType: string;
  status: DocumentStatus;
  pageCount: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateDocumentInput = {
  projectId: string;
  ownerId: string;
  name: string;
  storagePath: string;
  pageCount?: number | null;
};

export type UpdateDocumentStatusInput = {
  id: string;
  ownerId: string;
  status: DocumentStatus;
  pageCount?: number | null;
};

export interface DocumentStore {
  create(input: CreateDocumentInput): Promise<Document>;
  listByProject(input: { projectId: string; ownerId: string }): Promise<Document[]>;
  updateStatus(input: UpdateDocumentStatusInput): Promise<Document | null>;
}

export function createInMemoryDocumentStore(): DocumentStore {
  const documents = new Map<string, Document>();

  return {
    async create(input) {
      const now = new Date();
      const document: Document = {
        id: crypto.randomUUID(),
        projectId: input.projectId,
        ownerId: input.ownerId,
        name: input.name,
        storagePath: input.storagePath,
        mimeType: "application/pdf",
        status: "uploading",
        pageCount: input.pageCount ?? null,
        createdAt: now,
        updatedAt: now,
      };

      documents.set(document.id, document);

      return document;
    },
    async listByProject({ projectId, ownerId }) {
      return [...documents.values()]
        .filter((document) => document.projectId === projectId && document.ownerId === ownerId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    },
    async updateStatus({ id, ownerId, status, pageCount }) {
      const document = documents.get(id);

      if (!document || document.ownerId !== ownerId) {
        return null;
      }

      const updatedDocument: Document = {
        ...document,
        status,
        pageCount: pageCount === undefined ? document.pageCount : pageCount,
        updatedAt: new Date(),
      };

      documents.set(id, updatedDocument);

      return updatedDocument;
    },
  };
}
