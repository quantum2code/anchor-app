import { type AnchorStore } from "../anchor-store";
import { type DocumentStore } from "../document-store";
import { type ProjectStore } from "../project-store";
import { protectedProcedure, publicProcedure, router } from "../index";
import { createAnchorsRouter } from "./anchors";
import { createDocumentsRouter } from "./documents";
import { createProjectsRouter } from "./projects";

export type AppRouterDependencies = {
  anchorStore?: AnchorStore;
  documentStore?: DocumentStore;
  projectStore?: ProjectStore;
};

export function createAppRouter(dependencies: AppRouterDependencies = {}) {
  const { anchorStore, documentStore, projectStore } = dependencies;

  if (!projectStore || !documentStore || !anchorStore) {
    throw new Error("createAppRouter requires a projectStore, documentStore, and anchorStore");
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
    anchors: createAnchorsRouter(projectStore, documentStore, anchorStore),
    documents: createDocumentsRouter(projectStore, documentStore),
    projects: createProjectsRouter(projectStore, documentStore),
  });
}
export type AppRouter = ReturnType<typeof createAppRouter>;
