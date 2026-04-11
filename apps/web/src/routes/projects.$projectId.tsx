import { Button, buttonVariants } from "@anchor/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@anchor/ui/components/card";
import { Input } from "@anchor/ui/components/input";
import { Label } from "@anchor/ui/components/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
} from "@tanstack/react-router";
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
import { DropZoneTabExp } from "@/components/dropzone";

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
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
      <div className="flex h-15 gap-2">
        <div className="scrollbar-slim flex overflow-x-scroll overflow-y-hidden h-15">
          {documents.length && (
            <div className="flex">
              {documents.map((document) => {
                const isReady = document.status === "ready";

                return (
                  <div key={document.id}>
                    {isReady && (
                      <Link
                        to="/projects/$projectId/documents/$documentId"
                        params={{ projectId, documentId: document.id }}
                      >
                        <div
                          className={
                            "max-w-40 h-full p-2 border overflow-hidden flex items-center px-4"
                          }
                        >
                          <p className="font-medium line-clamp-1 text-ellipsis">
                            {document.name}
                          </p>
                        </div>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <form
          className="grid gap-3 z-50"
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
              toast.error(
                "Only PDF documents are supported in this first slice.",
              );
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

              toast.error(
                error instanceof Error
                  ? error.message
                  : "Document upload failed.",
              );
            }
          }}
        >
          <DropZoneTabExp
            dzDisabled={createDocument.isPending}
            onDropHandler={(acceptedFiles) => {
              setSelectedFile(acceptedFiles[0] ?? null);
            }}
            btnDisabled={
              !selectedFile ||
              createDocument.isPending ||
              updateDocumentStatus.isPending
            }
            buttonLabel={
              createDocument.isPending || updateDocumentStatus.isPending
                ? "Uploading PDF..."
                : "Upload PDF"
            }
            selectedFile={selectedFile}
          />
        </form>
      </div>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
