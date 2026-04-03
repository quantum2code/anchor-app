import { describe, expect, it } from "vitest";

import { createInMemoryAnchorStore } from "../anchor-store";
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
      anchorStore: createInMemoryAnchorStore(),
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
      anchorStore: createInMemoryAnchorStore(),
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
      anchorStore: createInMemoryAnchorStore(),
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

  it("lets owners load a ready document for the reader while blocking unfinished documents and non-owners", async () => {
    const appRouter = createAppRouter({
      anchorStore: createInMemoryAnchorStore(),
      documentStore: createInMemoryDocumentStore(),
      projectStore: createInMemoryProjectStore(),
    });

    const owner = appRouter.createCaller(createSignedInContext("user-1"));
    const otherUser = appRouter.createCaller(createSignedInContext("user-2"));

    const project = await owner.projects.create({ name: "Reader workspace" });
    const uploadingDocument = await owner.documents.create({
      projectId: project.id,
      name: "draft.pdf",
      storagePath: "user-1/projects/reader-workspace/draft.pdf",
    });
    const readyDocument = await owner.documents.create({
      projectId: project.id,
      name: "ready.pdf",
      storagePath: "user-1/projects/reader-workspace/ready.pdf",
      pageCount: 18,
    });

    await owner.documents.updateStatus({
      id: readyDocument.id,
      projectId: project.id,
      status: "ready",
      pageCount: 18,
    });

    const readerDocument = await owner.documents.readerById({
      projectId: project.id,
      documentId: readyDocument.id,
    });

    expect(readerDocument).toMatchObject({
      id: readyDocument.id,
      projectId: project.id,
      name: "ready.pdf",
      status: "ready",
      pageCount: 18,
    });

    await expect(
      owner.documents.readerById({
        projectId: project.id,
        documentId: uploadingDocument.id,
      }),
    ).rejects.toThrow("Document is not ready");

    await expect(
      otherUser.documents.readerById({
        projectId: project.id,
        documentId: readyDocument.id,
      }),
    ).rejects.toThrow("Project not found");
  });

  it("loads only anchor summaries that overlap the requested page range and defers full detail to byId", async () => {
    const appRouter = createAppRouter({
      anchorStore: createInMemoryAnchorStore(),
      documentStore: createInMemoryDocumentStore(),
      projectStore: createInMemoryProjectStore(),
    });

    const owner = appRouter.createCaller(createSignedInContext("user-1"));
    const otherUser = appRouter.createCaller(createSignedInContext("user-2"));

    const project = await owner.projects.create({ name: "Anchors" });
    const document = await owner.documents.create({
      projectId: project.id,
      name: "annotated.pdf",
      storagePath: "user-1/projects/anchors/annotated.pdf",
      pageCount: 30,
    });

    await owner.documents.updateStatus({
      id: document.id,
      projectId: project.id,
      status: "ready",
      pageCount: 30,
    });

    const anchorOnPageTwo = await owner.anchors.create({
      projectId: project.id,
      documentId: document.id,
      quote: "On page two",
      summary: "Summary on page two",
      content: "Detailed note on page two",
      pageStart: 2,
      pageEnd: 2,
    });
    await owner.anchors.create({
      projectId: project.id,
      documentId: document.id,
      quote: "Cross-page quote",
      summary: "Summary across pages four and five",
      content: "Detailed note across pages four and five",
      pageStart: 4,
      pageEnd: 5,
    });
    await owner.anchors.create({
      projectId: project.id,
      documentId: document.id,
      quote: "Late-page quote",
      summary: "Summary on page eight",
      content: "Detailed note on page eight",
      pageStart: 8,
      pageEnd: 8,
    });

    const visibleAnchors = await owner.anchors.listByPageRange({
      projectId: project.id,
      documentId: document.id,
      startPage: 3,
      endPage: 5,
    });

    expect(visibleAnchors).toHaveLength(1);
    expect(visibleAnchors[0]).toMatchObject({
      summary: "Summary across pages four and five",
      pageStart: 4,
      pageEnd: 5,
    });
    expect(visibleAnchors[0]).not.toHaveProperty("content");

    const anchorDetail = await owner.anchors.byId({
      projectId: project.id,
      documentId: document.id,
      anchorId: anchorOnPageTwo.id,
    });

    expect(anchorDetail).toMatchObject({
      id: anchorOnPageTwo.id,
      quote: "On page two",
      summary: "Summary on page two",
      content: "Detailed note on page two",
      pageStart: 2,
      pageEnd: 2,
    });

    await expect(
      otherUser.anchors.listByPageRange({
        projectId: project.id,
        documentId: document.id,
        startPage: 1,
        endPage: 5,
      }),
    ).rejects.toThrow("Project not found");
  });

  it("lets owners update and delete anchors while validating page ranges", async () => {
    const appRouter = createAppRouter({
      anchorStore: createInMemoryAnchorStore(),
      documentStore: createInMemoryDocumentStore(),
      projectStore: createInMemoryProjectStore(),
    });

    const owner = appRouter.createCaller(createSignedInContext("user-1"));

    const project = await owner.projects.create({ name: "Anchor CRUD" });
    const document = await owner.documents.create({
      projectId: project.id,
      name: "crud.pdf",
      storagePath: "user-1/projects/anchor-crud/crud.pdf",
      pageCount: 12,
    });

    await owner.documents.updateStatus({
      id: document.id,
      projectId: project.id,
      status: "ready",
      pageCount: 12,
    });

    const createdAnchor = await owner.anchors.create({
      projectId: project.id,
      documentId: document.id,
      quote: "Original quote",
      summary: "Original summary",
      content: "Original detail",
      pageStart: 6,
      pageEnd: 6,
    });

    const updatedAnchor = await owner.anchors.update({
      projectId: project.id,
      documentId: document.id,
      anchorId: createdAnchor.id,
      quote: "Updated quote",
      summary: "Updated summary",
      content: "Updated detail",
      pageStart: 6,
      pageEnd: 7,
    });

    expect(updatedAnchor).toMatchObject({
      id: createdAnchor.id,
      quote: "Updated quote",
      summary: "Updated summary",
      content: "Updated detail",
      pageStart: 6,
      pageEnd: 7,
    });

    await expect(
      owner.anchors.create({
        projectId: project.id,
        documentId: document.id,
        quote: "Bad range",
        summary: "Bad range",
        content: "Bad range",
        pageStart: 7,
        pageEnd: 6,
      }),
    ).rejects.toThrow("Anchor page range is invalid");

    const deletedAnchor = await owner.anchors.delete({
      projectId: project.id,
      documentId: document.id,
      anchorId: createdAnchor.id,
    });

    expect(deletedAnchor.id).toBe(createdAnchor.id);

    await expect(
      owner.anchors.byId({
        projectId: project.id,
        documentId: document.id,
        anchorId: createdAnchor.id,
      }),
    ).rejects.toThrow("Anchor not found");
  });
});
