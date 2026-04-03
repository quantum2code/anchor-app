export type Anchor = {
  id: string;
  documentId: string;
  ownerId: string;
  quote: string;
  summary: string;
  content: string;
  pageStart: number;
  pageEnd: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AnchorSummary = Omit<Anchor, "content">;

export type CreateAnchorInput = {
  documentId: string;
  ownerId: string;
  quote: string;
  summary: string;
  content: string;
  pageStart: number;
  pageEnd: number;
};

export type UpdateAnchorInput = {
  id: string;
  ownerId: string;
  quote: string;
  summary: string;
  content: string;
  pageStart: number;
  pageEnd: number;
};

export interface AnchorStore {
  create(input: CreateAnchorInput): Promise<Anchor>;
  getById(input: { id: string; ownerId: string }): Promise<Anchor | null>;
  listByPageRange(input: {
    documentId: string;
    ownerId: string;
    startPage: number;
    endPage: number;
  }): Promise<AnchorSummary[]>;
  update(input: UpdateAnchorInput): Promise<Anchor | null>;
  delete(input: { id: string; ownerId: string }): Promise<Anchor | null>;
}

export function createInMemoryAnchorStore(): AnchorStore {
  const anchors = new Map<string, Anchor>();

  return {
    async create(input) {
      const now = new Date();
      const anchor: Anchor = {
        id: crypto.randomUUID(),
        documentId: input.documentId,
        ownerId: input.ownerId,
        quote: input.quote,
        summary: input.summary,
        content: input.content,
        pageStart: input.pageStart,
        pageEnd: input.pageEnd,
        createdAt: now,
        updatedAt: now,
      };

      anchors.set(anchor.id, anchor);

      return anchor;
    },
    async getById({ id, ownerId }) {
      const anchor = anchors.get(id);

      if (!anchor || anchor.ownerId !== ownerId) {
        return null;
      }

      return anchor;
    },
    async listByPageRange({ documentId, ownerId, startPage, endPage }) {
      return [...anchors.values()]
        .filter(
          (anchor) =>
            anchor.documentId === documentId &&
            anchor.ownerId === ownerId &&
            anchor.pageStart <= endPage &&
            anchor.pageEnd >= startPage,
        )
        .sort((left, right) => {
          if (left.pageStart !== right.pageStart) {
            return left.pageStart - right.pageStart;
          }

          return left.createdAt.getTime() - right.createdAt.getTime();
        })
        .map(({ content: _content, ...summary }) => summary);
    },
    async update(input) {
      const anchor = anchors.get(input.id);

      if (!anchor || anchor.ownerId !== input.ownerId) {
        return null;
      }

      const updatedAnchor: Anchor = {
        ...anchor,
        quote: input.quote,
        summary: input.summary,
        content: input.content,
        pageStart: input.pageStart,
        pageEnd: input.pageEnd,
        updatedAt: new Date(),
      };

      anchors.set(input.id, updatedAnchor);

      return updatedAnchor;
    },
    async delete({ id, ownerId }) {
      const anchor = anchors.get(id);

      if (!anchor || anchor.ownerId !== ownerId) {
        return null;
      }

      anchors.delete(id);

      return anchor;
    },
  };
}
