import { describe, expect, it } from "vitest";

import type { Context } from "../context";
import { createInMemoryProjectStore } from "../project-store";
import { createAppRouter } from "./index";

function createSignedInContext(userId: string): Context {
  return {
    auth: null,
    session: {
      user: {
        id: userId,
        name: `User ${userId}`,
        email: `${userId}@example.com`,
      },
    },
  } as Context;
}

describe("projects router", () => {
  it("lets signed-in users create projects, list only their own projects, and blocks non-owners", async () => {
    const appRouter = createAppRouter({
      projectStore: createInMemoryProjectStore(),
    });

    const userOne = appRouter.createCaller(createSignedInContext("user-1"));
    const userTwo = appRouter.createCaller(createSignedInContext("user-2"));

    const created = await userOne.projects.create({ name: "First project" });

    expect(created.name).toBe("First project");
    expect(created.ownerId).toBe("user-1");

    const userOneProjects = await userOne.projects.list();
    const userTwoProjects = await userTwo.projects.list();

    expect(userOneProjects).toHaveLength(1);
    expect(userOneProjects[0]?.id).toBe(created.id);
    expect(userTwoProjects).toHaveLength(0);

    const fetched = await userOne.projects.byId({ id: created.id });

    expect(fetched.id).toBe(created.id);
    expect(fetched.ownerId).toBe("user-1");

    await expect(userTwo.projects.byId({ id: created.id })).rejects.toThrow("Project not found");
  });
});
