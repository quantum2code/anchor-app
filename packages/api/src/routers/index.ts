import { type ProjectStore } from "../project-store";
import { protectedProcedure, publicProcedure, router } from "../index";
import { createProjectsRouter } from "./projects";

export type AppRouterDependencies = {
  projectStore?: ProjectStore;
};

export function createAppRouter(dependencies: AppRouterDependencies = {}) {
  const { projectStore } = dependencies;

  if (!projectStore) {
    throw new Error("createAppRouter requires a projectStore");
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
    projects: createProjectsRouter(projectStore),
  });
}
export type AppRouter = ReturnType<typeof createAppRouter>;
