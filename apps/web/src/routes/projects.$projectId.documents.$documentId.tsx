import { Button, buttonVariants } from "@anchor/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@anchor/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { ChevronLeftIcon, FileTextIcon, LoaderCircleIcon } from "lucide-react";
import { pdfjs, Document, Page } from "react-pdf";
import {
  startTransition,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getAuthSession } from "@/lib/auth-client";
import { downloadDocumentFromStorage } from "@/lib/document-storage";
import { trpc } from "@/utils/trpc";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

const PAGE_BATCH_SIZE = 3;

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export const Route = createFileRoute(
  "/projects/$projectId/documents/$documentId",
)({
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
      context.trpc.documents.readerById.queryOptions({
        projectId: params.projectId,
        documentId: params.documentId,
      }),
    );
  },
});

function RouteComponent() {
  const { projectId, documentId } = Route.useParams();
  const [loadedBatchCount, setLoadedBatchCount] = useState(1);
  const documentQuery = useQuery(
    trpc.documents.readerById.queryOptions({
      projectId,
      documentId,
    }),
  );
  const documentRecord = documentQuery.data;
  const pdfBytesQuery = useQuery({
    queryKey: ["document-pdf", documentRecord?.storagePath],
    enabled: Boolean(documentRecord?.storagePath),
    queryFn: async () => {
      return downloadDocumentFromStorage({
        storagePath: documentRecord!.storagePath,
      });
    },
    staleTime: 5 * 60 * 1000,
  });
  const [pageCount, setPageCount] = useState<number>(
    documentRecord?.pageCount ?? 0,
  );
  const [pdfError, setPdfError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const hasUserScrolledRef = useRef(false);

  useEffect(() => {
    setPageCount(documentRecord?.pageCount ?? 0);
  }, [documentRecord?.pageCount]);

  const totalPages = pageCount || documentRecord?.pageCount || 0;
  const totalBatches = totalPages ? Math.ceil(totalPages / PAGE_BATCH_SIZE) : 0;

  useEffect(() => {
    if (!totalBatches) {
      return;
    }

    if (loadedBatchCount > totalBatches) {
      startTransition(() => {
        setLoadedBatchCount(totalBatches);
      });
    }
  }, [loadedBatchCount, totalBatches]);

  const visiblePageNumbers = useMemo(() => {
    if (!totalPages) {
      return [];
    }

    const endPage = Math.min(loadedBatchCount * PAGE_BATCH_SIZE, totalPages);

    return Array.from({ length: endPage }, (_value, index) => index + 1);
  }, [loadedBatchCount, totalPages]);
  const deferredPageNumbers = useDeferredValue(visiblePageNumbers);
  const pdfFile = useMemo(() => {
    if (!pdfBytesQuery.data) {
      return null;
    }

    return pdfBytesQuery.data;
  }, [pdfBytesQuery.data]);

  useEffect(() => {
    function markUserScrolled() {
      if (window.scrollY > 0) {
        hasUserScrolledRef.current = true;
      }
    }

    window.addEventListener("scroll", markUserScrolled, { passive: true });

    return () => {
      window.removeEventListener("scroll", markUserScrolled);
    };
  }, []);

  useEffect(() => {
    const target = loadMoreRef.current;

    if (!target || !totalBatches || loadedBatchCount >= totalBatches) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting || !hasUserScrolledRef.current) {
          return;
        }

        startTransition(() => {
          setLoadedBatchCount((currentCount) =>
            Math.min(currentCount + 1, totalBatches),
          );
        });
      },
      {
        rootMargin: "800px 0px",
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [loadedBatchCount, totalBatches]);

  useEffect(() => {
    if (!totalBatches || loadedBatchCount >= totalBatches) {
      return;
    }

    function maybeLoadNextBatch() {
      const target = loadMoreRef.current;

      if (!target || !hasUserScrolledRef.current) {
        return;
      }

      const rect = target.getBoundingClientRect();
      const viewportHeight =
        window.innerHeight || globalThis.document.documentElement.clientHeight;

      if (rect.top <= viewportHeight + 800) {
        startTransition(() => {
          setLoadedBatchCount((currentCount) =>
            Math.min(currentCount + 1, totalBatches),
          );
        });
      }
    }

    window.addEventListener("scroll", maybeLoadNextBatch, { passive: true });
    window.addEventListener("resize", maybeLoadNextBatch);

    return () => {
      window.removeEventListener("scroll", maybeLoadNextBatch);
      window.removeEventListener("resize", maybeLoadNextBatch);
    };
  }, [loadedBatchCount, totalBatches]);

  const batchStart = visiblePageNumbers[0] ?? 0;
  const batchEnd = visiblePageNumbers.at(-1) ?? 0;
  const isPdfPending = pdfBytesQuery.isPending;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6">
      <div className="flex flex-wrap gap-3">
        <Link
          to="/projects/$projectId"
          params={{ projectId }}
          className={buttonVariants({ variant: "outline" })}
        >
          Back to Workspace
        </Link>
        {documentRecord ? (
          <a
            href="#reader-surface"
            className={buttonVariants({ variant: "ghost" })}
          >
            Jump to Reader
          </a>
        ) : null}
      </div>

      <div>
        <Card className="min-h-[32rem]" id="reader-surface">
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-32 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {totalBatches
                    ? `${loadedBatchCount} / ${totalBatches} batches`
                    : "No pages"}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!totalBatches || loadedBatchCount >= totalBatches}
                  onClick={() => {
                    startTransition(() => {
                      setLoadedBatchCount((currentCount) =>
                        Math.min(currentCount + 1, totalBatches),
                      );
                    });
                  }}
                >
                  <ChevronLeftIcon className="-rotate-90" />
                  {`Load next ${PAGE_BATCH_SIZE}`}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid gap-2 border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Visible Page Range
              </p>
              <p className="text-sm">
                {batchStart && batchEnd
                  ? `Pages ${batchStart}-${batchEnd}`
                  : "Page data pending"}
              </p>
            </div>

            {documentQuery.isPending || isPdfPending ? (
              <ReaderState
                icon={<LoaderCircleIcon className="size-5 animate-spin" />}
                title="Loading PDF batch"
                description="The document is downloading before the first pages render."
              />
            ) : null}

            {pdfBytesQuery.isError ? (
              <ReaderState
                icon={<FileTextIcon className="size-5" />}
                title="Storage download failed"
                description={pdfBytesQuery.error.message}
              />
            ) : null}

            {pdfError ? (
              <ReaderState
                icon={<FileTextIcon className="size-5" />}
                title="PDF rendering failed"
                description={pdfError}
              />
            ) : null}

            {pdfFile && !pdfError ? (
              <Document
                file={pdfFile}
                loading={null}
                onLoadSuccess={({ numPages }) => {
                  setPdfError(null);
                  setPageCount(numPages);
                }}
                onLoadError={(error) => {
                  setPdfError(error.message);
                }}
                error={null}
                className="flex flex-col gap-6 items-center"
              >
                {deferredPageNumbers.map((pageNumber) => (
                  <ReactPdfPage key={pageNumber} pageNumber={pageNumber} />
                ))}

                {loadedBatchCount < totalBatches ? (
                  <div
                    ref={loadMoreRef}
                    className="grid min-h-32 place-items-center border border-dashed border-border bg-muted/20 p-6 text-center"
                  >
                    <div className="grid gap-2 text-sm text-muted-foreground">
                      <p>
                        Scroll to load pages {batchEnd + 1}-
                        {Math.min(batchEnd + PAGE_BATCH_SIZE, totalPages)}.
                      </p>
                      <p>{`The next ${PAGE_BATCH_SIZE}-page batch will hydrate automatically.`}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid min-h-24 place-items-center border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                    End of document
                  </div>
                )}
              </Document>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReaderState(input: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="grid min-h-64 place-items-center border border-dashed border-border bg-background p-6 text-center">
      <div className="grid max-w-md gap-3">
        <div className="flex justify-center text-muted-foreground">
          {input.icon}
        </div>
        <p className="text-sm font-medium">{input.title}</p>
        <p className="text-sm text-muted-foreground">{input.description}</p>
      </div>
    </div>
  );
}

function ReactPdfPage(input: { pageNumber: number }) {
  const [pageError, setPageError] = useState<string | null>(null);

  return (
    <div className="flex flex-col w-fit">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>Page {input.pageNumber}</span>
        <span>{pageError ? "Failed" : "Ready"}</span>
      </div>
      <Page
        pageNumber={input.pageNumber}
        renderAnnotationLayer
        renderTextLayer
        onRenderError={(error) => {
          setPageError(error.message);
        }}
        onGetTextError={(error) => {
          setPageError(error.message);
        }}
        loading={
          <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">
            Rendering page {input.pageNumber}...
          </div>
        }
        error={
          <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">
            This page could not be rendered.
          </div>
        }
      />
    </div>
  );
}
