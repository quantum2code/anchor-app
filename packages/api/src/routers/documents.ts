import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { DocumentStore } from "../document-store";
import type { ProjectStore } from "../project-store";
import { protectedProcedure, router } from "../index";

export function createDocumentsRouter(projectStore: ProjectStore, documentStore: DocumentStore) {
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

  return router({
    create: protectedProcedure
      .input(
        z.object({
          projectId: z.string().min(1),
          name: z.string().trim().min(1).max(255),
          storagePath: z.string().trim().min(1).max(512),
          pageCount: z.number().int().positive().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertOwnedProject(input.projectId, ctx.session.user.id);

        return documentStore.create({
          projectId: input.projectId,
          ownerId: ctx.session.user.id,
          name: input.name,
          storagePath: input.storagePath,
          pageCount: input.pageCount,
        });
      }),
    listByProject: protectedProcedure
      .input(
        z.object({
          projectId: z.string().min(1),
        }),
      )
      .query(async ({ ctx, input }) => {
        await assertOwnedProject(input.projectId, ctx.session.user.id);

        return documentStore.listByProject({
          projectId: input.projectId,
          ownerId: ctx.session.user.id,
        });
      }),
    readerById: protectedProcedure
      .input(
        z.object({
          projectId: z.string().min(1),
          documentId: z.string().min(1),
        }),
      )
      .query(async ({ ctx, input }) => {
        await assertOwnedProject(input.projectId, ctx.session.user.id);

        const document = await documentStore.getById({
          id: input.documentId,
          ownerId: ctx.session.user.id,
        });

        if (!document || document.projectId !== input.projectId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Document not found",
          });
        }

        if (document.status !== "ready") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Document is not ready",
          });
        }

        return document;
      }),
    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1),
          projectId: z.string().min(1),
          status: z.enum(["uploading", "processing", "ready", "failed"]),
          pageCount: z.number().int().positive().nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertOwnedProject(input.projectId, ctx.session.user.id);

        const document = await documentStore.updateStatus({
          id: input.id,
          ownerId: ctx.session.user.id,
          status: input.status,
          pageCount: input.pageCount,
        });

        if (!document) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Document not found",
          });
        }

        return document;
      }),
  });
}
