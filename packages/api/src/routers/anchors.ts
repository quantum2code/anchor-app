import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { AnchorStore } from "../anchor-store";
import type { DocumentStore } from "../document-store";
import type { ProjectStore } from "../project-store";
import { protectedProcedure, router } from "../index";

const anchorRangeSchema = z
  .object({
    pageStart: z.number().int().positive(),
    pageEnd: z.number().int().positive(),
  })
  .refine((value) => value.pageEnd >= value.pageStart, {
    message: "Anchor page range is invalid",
    path: ["pageEnd"],
  });

const visiblePageRangeSchema = z
  .object({
    startPage: z.number().int().positive(),
    endPage: z.number().int().positive(),
  })
  .refine((value) => value.endPage >= value.startPage, {
    message: "Visible page range is invalid",
    path: ["endPage"],
  });

export function createAnchorsRouter(
  projectStore: ProjectStore,
  documentStore: DocumentStore,
  anchorStore: AnchorStore,
) {
  async function assertOwnedProject(projectId: string, ownerId: string) {
    const project = await projectStore.getById({ id: projectId, ownerId });

    if (!project) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    return project;
  }

  async function assertOwnedDocument(projectId: string, documentId: string, ownerId: string) {
    const document = await documentStore.getById({ id: documentId, ownerId });

    if (!document || document.projectId !== projectId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Document not found",
      });
    }

    return document;
  }

  async function assertReadyDocument(projectId: string, documentId: string, ownerId: string) {
    const document = await assertOwnedDocument(projectId, documentId, ownerId);

    if (document.status !== "ready") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Document is not ready",
      });
    }

    return document;
  }

  return router({
    create: protectedProcedure
      .input(
        z
          .object({
            projectId: z.string().min(1),
            documentId: z.string().min(1),
            quote: z.string().trim().min(1).max(2_000),
            summary: z.string().trim().min(1).max(2_000),
            content: z.string().trim().min(1).max(20_000),
          })
          .and(anchorRangeSchema),
      )
      .mutation(async ({ ctx, input }) => {
        await assertOwnedProject(input.projectId, ctx.session.user.id);
        await assertOwnedDocument(input.projectId, input.documentId, ctx.session.user.id);

        return anchorStore.create({
          documentId: input.documentId,
          ownerId: ctx.session.user.id,
          quote: input.quote,
          summary: input.summary,
          content: input.content,
          pageStart: input.pageStart,
          pageEnd: input.pageEnd,
        });
      }),
    listByPageRange: protectedProcedure
      .input(
        z
          .object({
            projectId: z.string().min(1),
            documentId: z.string().min(1),
          })
          .and(visiblePageRangeSchema),
      )
      .query(async ({ ctx, input }) => {
        await assertOwnedProject(input.projectId, ctx.session.user.id);
        await assertReadyDocument(input.projectId, input.documentId, ctx.session.user.id);

        return anchorStore.listByPageRange({
          documentId: input.documentId,
          ownerId: ctx.session.user.id,
          startPage: input.startPage,
          endPage: input.endPage,
        });
      }),
    byId: protectedProcedure
      .input(
        z.object({
          projectId: z.string().min(1),
          documentId: z.string().min(1),
          anchorId: z.string().min(1),
        }),
      )
      .query(async ({ ctx, input }) => {
        await assertOwnedProject(input.projectId, ctx.session.user.id);
        await assertReadyDocument(input.projectId, input.documentId, ctx.session.user.id);

        const anchor = await anchorStore.getById({
          id: input.anchorId,
          ownerId: ctx.session.user.id,
        });

        if (!anchor || anchor.documentId !== input.documentId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Anchor not found",
          });
        }

        return anchor;
      }),
    update: protectedProcedure
      .input(
        z
          .object({
            projectId: z.string().min(1),
            documentId: z.string().min(1),
            anchorId: z.string().min(1),
            quote: z.string().trim().min(1).max(2_000),
            summary: z.string().trim().min(1).max(2_000),
            content: z.string().trim().min(1).max(20_000),
          })
          .and(anchorRangeSchema),
      )
      .mutation(async ({ ctx, input }) => {
        await assertOwnedProject(input.projectId, ctx.session.user.id);
        await assertOwnedDocument(input.projectId, input.documentId, ctx.session.user.id);

        const existingAnchor = await anchorStore.getById({
          id: input.anchorId,
          ownerId: ctx.session.user.id,
        });

        if (!existingAnchor || existingAnchor.documentId !== input.documentId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Anchor not found",
          });
        }

        const updatedAnchor = await anchorStore.update({
          id: input.anchorId,
          ownerId: ctx.session.user.id,
          quote: input.quote,
          summary: input.summary,
          content: input.content,
          pageStart: input.pageStart,
          pageEnd: input.pageEnd,
        });

        if (!updatedAnchor) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Anchor not found",
          });
        }

        return updatedAnchor;
      }),
    delete: protectedProcedure
      .input(
        z.object({
          projectId: z.string().min(1),
          documentId: z.string().min(1),
          anchorId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertOwnedProject(input.projectId, ctx.session.user.id);
        await assertOwnedDocument(input.projectId, input.documentId, ctx.session.user.id);

        const existingAnchor = await anchorStore.getById({
          id: input.anchorId,
          ownerId: ctx.session.user.id,
        });

        if (!existingAnchor || existingAnchor.documentId !== input.documentId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Anchor not found",
          });
        }

        const deletedAnchor = await anchorStore.delete({
          id: input.anchorId,
          ownerId: ctx.session.user.id,
        });

        if (!deletedAnchor) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Anchor not found",
          });
        }

        return deletedAnchor;
      }),
  });
}
