import { describe, expect, it } from "vitest";

import { createInMemoryDocumentStore } from "../document-store";
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
      documentStore: createInMemoryDocumentStore(),
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

  it("lets project owners create and list PDF documents with lifecycle state", async () => {
    const appRouter = createAppRouter({
      documentStore: createInMemoryDocumentStore(),
      projectStore: createInMemoryProjectStore(),
    });

    const owner = appRouter.createCaller(createSignedInContext("user-1"));
    const otherUser = appRouter.createCaller(createSignedInContext("user-2"));

    const project = await owner.projects.create({ name: "Reading queue" });

    const createdDocument = await owner.documents.create({
      projectId: project.id,
      name: "dense-paper.pdf",
      storagePath: "user-1/projects/reading-queue/dense-paper.pdf",
      pageCount: 12,
    });

    expect(createdDocument.projectId).toBe(project.id);
    expect(createdDocument.ownerId).toBe("user-1");
    expect(createdDocument.mimeType).toBe("application/pdf");
    expect(createdDocument.status).toBe("uploading");
    expect(createdDocument.pageCount).toBe(12);

    const ownerProject = await owner.projects.byId({ id: project.id });

    expect(ownerProject.documents).toHaveLength(1);
    expect(ownerProject.documents[0]).toMatchObject({
      id: createdDocument.id,
      name: "dense-paper.pdf",
      status: "uploading",
    });

    await expect(
      otherUser.documents.create({
        projectId: project.id,
        name: "intrusion.pdf",
        storagePath: "user-2/projects/hack/intrusion.pdf",
      }),
    ).rejects.toThrow("Project not found");
  });

  it("lets owners move documents through processing, ready, and failed states while keeping failed documents visible", async () => {
    const appRouter = createAppRouter({
      documentStore: createInMemoryDocumentStore(),
      projectStore: createInMemoryProjectStore(),
    });

    const owner = appRouter.createCaller(createSignedInContext("user-1"));
    const otherUser = appRouter.createCaller(createSignedInContext("user-2"));

    const project = await owner.projects.create({ name: "Paper trail" });
    const createdDocument = await owner.documents.create({
      projectId: project.id,
      name: "state-machine.pdf",
      storagePath: "user-1/projects/paper-trail/state-machine.pdf",
    });

    const processingDocument = await owner.documents.updateStatus({
      id: createdDocument.id,
      projectId: project.id,
      status: "processing",
    });

    expect(processingDocument.status).toBe("processing");

    const readyDocument = await owner.documents.updateStatus({
      id: createdDocument.id,
      projectId: project.id,
      status: "ready",
      pageCount: 24,
    });

    expect(readyDocument.status).toBe("ready");
    expect(readyDocument.pageCount).toBe(24);

    const failedDocument = await owner.documents.updateStatus({
      id: createdDocument.id,
      projectId: project.id,
      status: "failed",
    });

    expect(failedDocument.status).toBe("failed");

    const projectDocuments = await owner.documents.listByProject({ projectId: project.id });

    expect(projectDocuments).toHaveLength(1);
    expect(projectDocuments[0]).toMatchObject({
      id: createdDocument.id,
      status: "failed",
      pageCount: 24,
    });

    await expect(
      otherUser.documents.updateStatus({
        id: createdDocument.id,
        projectId: project.id,
        status: "ready",
      }),
    ).rejects.toThrow("Project not found");
  });
});
