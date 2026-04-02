import { type DocumentStore } from "../document-store";
import { type ProjectStore } from "../project-store";
import { protectedProcedure, publicProcedure, router } from "../index";
import { createDocumentsRouter } from "./documents";
import { createProjectsRouter } from "./projects";

export type AppRouterDependencies = {
  documentStore?: DocumentStore;
  projectStore?: ProjectStore;
};

export function createAppRouter(dependencies: AppRouterDependencies = {}) {
  const { documentStore, projectStore } = dependencies;

  if (!projectStore || !documentStore) {
    throw new Error("createAppRouter requires a projectStore and documentStore");
  }

  return router({
    healthCheck: publicProcedure.query(() => {
      return "OK";
    }),
    privateData: protectedProcedure.query(({ ctx }) => {
      return {
        message: "This is private",
        user: ctx.session.user,
      };
    }),
    documents: createDocumentsRouter(projectStore, documentStore),
    projects: createProjectsRouter(projectStore, documentStore),
  });
}
export type AppRouter = ReturnType<typeof createAppRouter>;
