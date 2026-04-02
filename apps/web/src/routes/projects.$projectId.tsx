import { Button, buttonVariants } from "@anchor/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@anchor/ui/components/card";
import { Input } from "@anchor/ui/components/input";
import { Label } from "@anchor/ui/components/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { getAuthSession } from "@/lib/auth-client";
import {
  DOCUMENTS_BUCKET,
  buildDocumentStoragePath,
  extractPdfPageCount,
  uploadDocumentToStorage,
} from "@/lib/document-storage";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/projects/$projectId")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      });
    }
    return { session };
  },
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      context.trpc.projects.byId.queryOptions({ id: params.projectId }),
    );
  },
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const { projectId } = Route.useParams();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const project = useQuery(trpc.projects.byId.queryOptions({ id: projectId }));
  const createDocument = useMutation(
    trpc.documents.create.mutationOptions({
      onSuccess: async () => {
        setSelectedFile(null);
        await project.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
  const updateDocumentStatus = useMutation(
    trpc.documents.updateStatus.mutationOptions({
      onSuccess: async () => {
        await project.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const documents = project.data?.documents ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-6">
        <Link to="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Back to Dashboard
        </Link>
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{project.data?.name ?? "Loading workspace..."}</CardTitle>
            <CardDescription>
              Upload a PDF into this owned workspace. Anchor tools stay locked until a document is
              ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 text-sm text-muted-foreground">
              <p>Project ID: {projectId}</p>
              <p>
                Access is resolved through the owned-project API, so non-owners are rejected before
                this page can load.
              </p>
            </div>

            <form
              className="grid gap-3"
              onSubmit={async (event) => {
                event.preventDefault();

                if (!selectedFile) {
                  toast.error("Choose a PDF to create the document record.");
                  return;
                }

                const looksLikePdf =
                  selectedFile.type === "application/pdf" ||
                  selectedFile.name.toLowerCase().endsWith(".pdf");

                if (!looksLikePdf) {
                  toast.error("Only PDF documents are supported in this first slice.");
                  return;
                }

                const userId = session.data?.user.id;

                if (!userId) {
                  toast.error("You must be signed in before uploading a document.");
                  return;
                }

                const storagePath = buildDocumentStoragePath({
                  userId,
                  projectId,
                  fileName: selectedFile.name,
                });

                const createdDocument = await createDocument.mutateAsync({
                  projectId,
                  name: selectedFile.name,
                  storagePath,
                });

                try {
                  await uploadDocumentToStorage({
                    storagePath,
                    file: selectedFile,
                  });

                  await updateDocumentStatus.mutateAsync({
                    id: createdDocument.id,
                    projectId,
                    status: "processing",
                  });

                  const pageCount = await extractPdfPageCount(selectedFile);

                  await updateDocumentStatus.mutateAsync({
                    id: createdDocument.id,
                    projectId,
                    status: "ready",
                    pageCount,
                  });

                  toast.success("PDF uploaded to storage and marked ready.");
                } catch (error) {
                  await updateDocumentStatus
                    .mutateAsync({
                      id: createdDocument.id,
                      projectId,
                      status: "failed",
                    })
                    .catch(() => undefined);

                  toast.error(error instanceof Error ? error.message : "Document upload failed.");
                }
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="document-file">PDF file</Label>
                <Input
                  id="document-file"
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={createDocument.isPending}
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] ?? null);
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Files upload into the private <code>{DOCUMENTS_BUCKET}</code> bucket under your
                user-scoped project path.
              </p>
              <Button
                type="submit"
                disabled={
                  !selectedFile || createDocument.isPending || updateDocumentStatus.isPending
                }
              >
                {createDocument.isPending || updateDocumentStatus.isPending
                  ? "Uploading PDF..."
                  : "Upload PDF"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Lifecycle state is visible here so upload, processing, success, and failure are all
              explicit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length ? (
              <div className="grid gap-3">
                {documents.map((document) => {
                  const isReady = document.status === "ready";

                  return (
                    <div key={document.id} className="grid gap-3 border border-border p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="grid gap-1">
                          <p className="font-medium">{document.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {document.mimeType} | {document.storagePath}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Page count: {document.pageCount ?? "pending extraction"}
                          </p>
                        </div>
                        <span className="w-fit border border-border px-2 py-1 text-xs uppercase tracking-[0.2em]">
                          {document.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {isReady ? (
                          <Link
                            to="/projects/$projectId/documents/$documentId"
                            params={{ projectId, documentId: document.id }}
                            className={buttonVariants({ variant: "default" })}
                          >
                            Open Reader
                          </Link>
                        ) : (
                          <Button type="button" disabled>
                            Open Reader
                          </Button>
                        )}
                      </div>

                      {!isReady ? (
                        <p className="text-sm text-muted-foreground">
                          Reader access stays locked until this document reaches the ready state.
                          Failed uploads stay visible without retry automation in this slice.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-dashed border-border p-6 text-sm text-muted-foreground">
                No documents yet. Upload a PDF to create a durable document record and expose its
                readiness state.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Outlet />
    </div>
  );
}
