import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { DocumentStore } from "../document-store";
import type { ProjectStore } from "../project-store";
import { protectedProcedure, router } from "../index";

export function createProjectsRouter(projectStore: ProjectStore, documentStore: DocumentStore) {
  return router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(120),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return projectStore.create({
          name: input.name,
          ownerId: ctx.session.user.id,
        });
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      return projectStore.list(ctx.session.user.id);
    }),
    byId: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1),
        }),
      )
      .query(async ({ ctx, input }) => {
        const project = await projectStore.getById({
          id: input.id,
          ownerId: ctx.session.user.id,
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        return {
          ...project,
          documents: await documentStore.listByProject({
            projectId: project.id,
            ownerId: ctx.session.user.id,
          }),
        };
      }),
  });
}
