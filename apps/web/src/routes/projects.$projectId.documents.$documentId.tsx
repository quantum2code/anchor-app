import { Button, buttonVariants } from "@anchor/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@anchor/ui/components/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { ChevronLeftIcon, FileTextIcon, LoaderCircleIcon } from "lucide-react";
import { pdfjs, Document, Page } from "react-pdf";
import {
  memo,
  startTransition,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { getAuthSession } from "@/lib/auth-client";
import { downloadDocumentFromStorage } from "@/lib/document-storage";
import { trpc } from "@/utils/trpc";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

const PAGE_BATCH_SIZE = 3;
const MAX_SUMMARY_LENGTH = 120;
const DEFAULT_ANCHOR_NOTE = "Saved from the reader selection prompt.";
const NOTE_DELAY_MS = 220;
const NOTE_SIZE = { width: 320, height: 172 };
const NOTE_GAP = 8;
const VIEWPORT_PADDING = 8;

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
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [selectionPrompt, setSelectionPrompt] = useState<SelectionPrompt | null>(null);
  const [selectionRectsViewport, setSelectionRectsViewport] = useState<DOMRect[]>([]);
  const [selectionRectsContainer, setSelectionRectsContainer] = useState<DOMRect[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptPosition, setPromptPosition] = useState<{ x: number; y: number }>({
    x: VIEWPORT_PADDING,
    y: VIEWPORT_PADDING,
  });
  const cursorPointRef = useRef<{ x: number; y: number } | null>(null);
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
  const readerPagesRef = useRef<HTMLDivElement | null>(null);
  const pdfLoadHandlerRef = useRef<(numPages: number) => void>(() => undefined);
  const pdfErrorHandlerRef = useRef<(message: string) => void>(() => undefined);
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
  const anchorsQuery = useQuery({
    ...trpc.anchors.listByPageRange.queryOptions({
      projectId,
      documentId,
      startPage: batchStart || 1,
      endPage: batchEnd || 1,
    }),
    enabled: Boolean(documentRecord && batchStart && batchEnd),
    staleTime: 30 * 1000,
  });
  const visibleAnchors = anchorsQuery.data ?? [];
  const anchorDetailQuery = useQuery({
    ...trpc.anchors.byId.queryOptions({
      projectId,
      documentId,
      anchorId: selectedAnchorId ?? "",
    }),
    enabled: Boolean(selectedAnchorId),
    staleTime: 30 * 1000,
  });
  const isPdfPending = pdfBytesQuery.isPending;
  const createAnchor = useMutation(
    trpc.anchors.create.mutationOptions({
      onSuccess: async (createdAnchor) => {
        clearTextSelection();
        setSelectionPrompt(null);
        setSelectedAnchorId(createdAnchor.id);
        await anchorsQuery.refetch();
        toast.success("Anchor saved for the current selection.");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  useEffect(() => {
    if (!selectedAnchorId) {
      return;
    }

    if (!visibleAnchors.some((anchor) => anchor.id === selectedAnchorId)) {
      setSelectedAnchorId(null);
    }
  }, [selectedAnchorId, visibleAnchors]);

  useEffect(() => {
    const readerRoot = readerPagesRef.current;

    if (!readerRoot) {
      return;
    }

    const activeReaderRoot = readerRoot;

    function clearSelectionUi() {
      setSelectionPrompt((currentValue) => (currentValue ? null : currentValue));
      setSelectionRectsViewport((currentValue) =>
        currentValue.length > 0 ? [] : currentValue,
      );
      setSelectionRectsContainer((currentValue) =>
        currentValue.length > 0 ? [] : currentValue,
      );
    }

    function updateSelectionState() {
      const selection = window.getSelection();
      const quote = selection?.toString().replace(/\s+/g, " ").trim() ?? "";

      if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !quote) {
        clearSelectionUi();
        return;
      }

      const range = selection.getRangeAt(0);
      const commonRoot =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;

      if (
        !commonRoot ||
        !activeReaderRoot.contains(commonRoot) ||
        !isNodeInsidePdfTextLayer(commonRoot)
      ) {
        clearSelectionUi();
        return;
      }

      const pageRange = getSelectionPageRange(selection);

      if (!pageRange) {
        clearSelectionUi();
        return;
      }

      const viewportRects = Array.from(range.getClientRects())
        .map((rect) => new DOMRect(rect.left, rect.top, rect.width, rect.height))
        .filter((rect) => rect.width > 0 && rect.height > 0);

      if (!viewportRects.length) {
        clearSelectionUi();
        return;
      }

      const containerRect = activeReaderRoot.getBoundingClientRect();
      const containerRects = viewportRects.map(
        (rect) =>
          new DOMRect(
            rect.left - containerRect.left + activeReaderRoot.scrollLeft,
            rect.top - containerRect.top + activeReaderRoot.scrollTop,
            rect.width,
            rect.height,
          ),
      );

      setSelectionRectsViewport(viewportRects);
      setSelectionRectsContainer(containerRects);
      setPromptPosition(getNotePosition(viewportRects, cursorPointRef.current));
      setSelectionPrompt({
        quote,
        pageStart: pageRange.pageStart,
        pageEnd: pageRange.pageEnd,
      });
    }

    function handleSelectionChange() {
      updateSelectionState();
    }

    function handlePointerUp(event: PointerEvent) {
      const target =
        event.target instanceof Node ? event.target : globalThis.document.body;

      if (!target || !activeReaderRoot.contains(target) || !isNodeInsidePdfTextLayer(target)) {
        return;
      }

      cursorPointRef.current = { x: event.clientX, y: event.clientY };
    }

    function handleWindowRefresh() {
      const selection = window.getSelection();

      if (!selection || selection.isCollapsed) {
        return;
      }

      updateSelectionState();
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("resize", handleWindowRefresh);
    window.addEventListener("scroll", handleWindowRefresh, true);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("resize", handleWindowRefresh);
      window.removeEventListener("scroll", handleWindowRefresh, true);
    };
  }, []);

  useEffect(() => {
    if (!selectionPrompt || selectionRectsViewport.length === 0) {
      setShowPrompt(false);
      return;
    }

    setShowPrompt(false);

    const timer = window.setTimeout(() => {
      requestAnimationFrame(() => {
        setShowPrompt(true);
      });
    }, NOTE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [selectionPrompt, selectionRectsViewport]);

  useEffect(() => {
    const readerRoot = readerPagesRef.current;

    if (!readerRoot) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const highlightTargets = readerRoot.querySelectorAll<HTMLElement>("[data-anchor-highlight]");
      for (const element of highlightTargets) {
        delete element.dataset.anchorHighlight;
        element.style.backgroundColor = "";
        element.style.borderRadius = "";
        element.style.boxShadow = "";
      }

      if (!visibleAnchors.length) {
        return;
      }

      for (const anchor of visibleAnchors) {
        const normalizedQuote = normalizeText(anchor.quote);

        if (!normalizedQuote) {
          continue;
        }

        for (let pageNumber = anchor.pageStart; pageNumber <= anchor.pageEnd; pageNumber += 1) {
          const pageRoot = readerRoot.querySelector<HTMLElement>(
            `[data-anchor-page-number="${pageNumber}"]`,
          );

          if (!pageRoot) {
            continue;
          }

          const textSpans = pageRoot.querySelectorAll<HTMLElement>(
            ".react-pdf__Page__textContent span",
          );

          for (const span of textSpans) {
            const spanText = normalizeText(span.textContent ?? "");

            if (!spanText || spanText.length < 3) {
              continue;
            }

            if (normalizedQuote.includes(spanText)) {
              span.dataset.anchorHighlight = anchor.id;
              span.style.backgroundColor = "rgba(245, 158, 11, 0.35)";
              span.style.borderRadius = "0.2rem";
              span.style.boxShadow =
                selectedAnchorId === anchor.id ? "0 0 0 1px rgba(245, 158, 11, 0.9)" : "none";
            }
          }
        }
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [deferredPageNumbers, selectedAnchorId, visibleAnchors]);
  pdfLoadHandlerRef.current = (numPages: number) => {
    setPdfError(null);
    setPageCount(numPages);
  };
  pdfErrorHandlerRef.current = (message: string) => {
    setPdfError(message);
  };

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

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
              <div className="grid gap-3 border border-border bg-background p-4">
                <div className="grid gap-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Anchor Summaries
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Only anchors overlapping pages {batchStart || "?"}-{batchEnd || "?"} are
                    loaded for this view.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Select text in the reader below to open a save-or-dismiss prompt.
                  </p>
                </div>

                {anchorsQuery.isPending ? (
                  <p className="text-sm text-muted-foreground">
                    Loading anchor summaries for the visible pages...
                  </p>
                ) : null}

                {anchorsQuery.isError ? (
                  <p className="text-sm text-muted-foreground">
                    {anchorsQuery.error.message}
                  </p>
                ) : null}

                {!anchorsQuery.isPending && !anchorsQuery.isError && !visibleAnchors.length ? (
                  <p className="text-sm text-muted-foreground">
                    No anchors overlap the current page range yet.
                  </p>
                ) : null}

                {visibleAnchors.length ? (
                  <div className="grid gap-2">
                    {visibleAnchors.map((anchor) => (
                      <button
                        key={anchor.id}
                        type="button"
                        className="grid gap-2 border border-border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40"
                        onClick={() => {
                          setSelectedAnchorId(anchor.id);
                        }}
                      >
                        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          <span>
                            Pages {anchor.pageStart}-{anchor.pageEnd}
                          </span>
                          <span>
                            {selectedAnchorId === anchor.id ? "Open" : "Preview"}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{anchor.summary}</p>
                        <p className="text-sm text-muted-foreground">{anchor.quote}</p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 border border-border bg-muted/20 p-4">
                <div className="grid gap-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Anchor Detail
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Full anchor content is fetched only after you open a summary, and saved
                    anchors come back after refresh from the page-range query.
                  </p>
                </div>

                {!selectedAnchorId ? (
                  <p className="text-sm text-muted-foreground">
                    Select an anchor summary to load its full detail.
                  </p>
                ) : null}

                {anchorDetailQuery.isPending ? (
                  <p className="text-sm text-muted-foreground">Loading anchor detail...</p>
                ) : null}

                {anchorDetailQuery.isError ? (
                  <p className="text-sm text-muted-foreground">
                    {anchorDetailQuery.error.message}
                  </p>
                ) : null}

                {anchorDetailQuery.data ? (
                  <div className="grid gap-3 text-sm">
                    <div className="grid gap-1">
                      <p className="font-medium">{anchorDetailQuery.data.summary}</p>
                      <p className="text-muted-foreground">{anchorDetailQuery.data.quote}</p>
                    </div>
                    <p>{anchorDetailQuery.data.content}</p>
                  </div>
                ) : null}
              </div>
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
              <div className="relative">
                {selectionRectsContainer.map((rect, index) => (
                  <div
                    key={`${rect.x}-${rect.y}-${index}`}
                    className="pointer-events-none absolute z-20 rounded-[5px] border-2 border-amber-500/30 bg-amber-500/20"
                    style={{
                      left: rect.left,
                      top: rect.top,
                      width: rect.width,
                      height: rect.height,
                    }}
                  />
                ))}
                <ReaderPdfSurface
                  pdfFile={pdfFile}
                  deferredPageNumbers={deferredPageNumbers}
                  readerPagesRef={readerPagesRef}
                  loadMoreRef={loadMoreRef}
                  pdfLoadHandlerRef={pdfLoadHandlerRef}
                  pdfErrorHandlerRef={pdfErrorHandlerRef}
                  loadedBatchCount={loadedBatchCount}
                  totalBatches={totalBatches}
                  batchEnd={batchEnd}
                  totalPages={totalPages}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
      {selectionPrompt ? (
        <div
          className="fixed z-50 w-80 max-w-[calc(100vw-2rem)] border border-border bg-background p-4 shadow-xl transition-[opacity,transform] duration-180 ease-out"
          style={{
            left: promptPosition.x,
            top: promptPosition.y,
            opacity: showPrompt ? 1 : 0,
            transform: showPrompt ? "translateY(0)" : "translateY(6px)",
          }}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
        >
          <div className="grid gap-3">
            <div className="grid gap-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Save Anchor
              </p>
              <p className="text-sm text-muted-foreground">
                Save this selection as a test anchor highlight?
              </p>
            </div>
            <div className="max-h-32 overflow-auto border border-border bg-muted/20 p-3 text-sm">
              {selectionPrompt.quote}
            </div>
            <p className="text-sm text-muted-foreground">
              Pages {selectionPrompt.pageStart}-{selectionPrompt.pageEnd}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={createAnchor.isPending}
                onClick={async () => {
                  await createAnchor.mutateAsync({
                    projectId,
                    documentId,
                    quote: selectionPrompt.quote,
                    summary: buildDefaultSummary(selectionPrompt.quote),
                    content: DEFAULT_ANCHOR_NOTE,
                    pageStart: selectionPrompt.pageStart,
                    pageEnd: selectionPrompt.pageEnd,
                  });
                }}
              >
                {createAnchor.isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={createAnchor.isPending}
                onClick={() => {
                  clearTextSelection();
                  setSelectionPrompt(null);
                }}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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

function ReactPdfPage(input: {
  pageNumber: number;
}) {
  const [pageError, setPageError] = useState<string | null>(null);

  return (
    <div className="flex w-fit flex-col" data-anchor-page-number={input.pageNumber}>
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

const ReaderPdfSurface = memo(function ReaderPdfSurface(input: {
  pdfFile: Blob;
  deferredPageNumbers: number[];
  readerPagesRef: React.RefObject<HTMLDivElement | null>;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  pdfLoadHandlerRef: React.RefObject<(numPages: number) => void>;
  pdfErrorHandlerRef: React.RefObject<(message: string) => void>;
  loadedBatchCount: number;
  totalBatches: number;
  batchEnd: number;
  totalPages: number;
}) {
  return (
    <div ref={input.readerPagesRef}>
      <Document
        file={input.pdfFile}
        loading={null}
        onLoadSuccess={({ numPages }) => {
          input.pdfLoadHandlerRef.current(numPages);
        }}
        onLoadError={(error) => {
          input.pdfErrorHandlerRef.current(error.message);
        }}
        error={null}
        className="flex flex-col gap-6 items-center"
      >
        {input.deferredPageNumbers.map((pageNumber) => (
          <ReactPdfPage key={pageNumber} pageNumber={pageNumber} />
        ))}

        {input.loadedBatchCount < input.totalBatches ? (
          <div
            ref={input.loadMoreRef}
            className="grid min-h-32 place-items-center border border-dashed border-border bg-muted/20 p-6 text-center"
          >
            <div className="grid gap-2 text-sm text-muted-foreground">
              <p>
                Scroll to load pages {input.batchEnd + 1}-
                {Math.min(input.batchEnd + PAGE_BATCH_SIZE, input.totalPages)}.
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
    </div>
  );
});

type SelectionPrompt = {
  quote: string;
  pageStart: number;
  pageEnd: number;
};

function buildDefaultSummary(quote: string) {
  if (quote.length <= MAX_SUMMARY_LENGTH) {
    return quote;
  }

  return `${quote.slice(0, MAX_SUMMARY_LENGTH - 1).trimEnd()}...`;
}

function getSelectionPageRange(selection: Selection) {
  const anchorPage = findPageNumberFromNode(selection.anchorNode);
  const focusPage = findPageNumberFromNode(selection.focusNode);

  if (!anchorPage || !focusPage) {
    return null;
  }

  return {
    pageStart: Math.min(anchorPage, focusPage),
    pageEnd: Math.max(anchorPage, focusPage),
  };
}

function findPageNumberFromNode(node: Node | null) {
  if (!node) {
    return null;
  }

  const element = node instanceof Element ? node : node.parentElement;
  const pageContainer = element?.closest("[data-anchor-page-number]");
  const pageNumber = pageContainer?.getAttribute("data-anchor-page-number");

  if (!pageNumber) {
    return null;
  }

  const parsedPageNumber = Number.parseInt(pageNumber, 10);

  return Number.isNaN(parsedPageNumber) ? null : parsedPageNumber;
}

function clearTextSelection() {
  window.getSelection()?.removeAllRanges();
}

function isNodeInsidePdfTextLayer(node: Node) {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest(".react-pdf__Page__textContent"));
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getNotePosition(
  rects: DOMRect[],
  cursor: { x: number; y: number } | null,
) {
  const lastRect = rects[rects.length - 1];

  if (!lastRect) {
    return { x: VIEWPORT_PADDING, y: VIEWPORT_PADDING };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = viewportWidth - NOTE_SIZE.width - VIEWPORT_PADDING;
  const maxTop = viewportHeight - NOTE_SIZE.height - VIEWPORT_PADDING;

  const fallbackTarget = {
    x: lastRect.left + lastRect.width / 2,
    y: lastRect.top + lastRect.height / 2,
  };
  const target = cursor ?? fallbackTarget;

  const anchors = [
    { left: target.x + NOTE_GAP, top: target.y + NOTE_GAP },
    {
      left: target.x - NOTE_GAP - NOTE_SIZE.width,
      top: target.y + NOTE_GAP,
    },
    {
      left: target.x + NOTE_GAP,
      top: target.y - NOTE_GAP - NOTE_SIZE.height,
    },
    {
      left: target.x - NOTE_GAP - NOTE_SIZE.width,
      top: target.y - NOTE_GAP - NOTE_SIZE.height,
    },
  ];

  const candidates = anchors.map((anchor) => {
    const left = clamp(anchor.left, VIEWPORT_PADDING, maxLeft);
    const top = clamp(anchor.top, VIEWPORT_PADDING, maxTop);
    const dx = target.x - left;
    const dy = target.y - top;

    return { left, top, dist: dx * dx + dy * dy };
  });

  const best = candidates.reduce((previous, next) =>
    next.dist < previous.dist ? next : previous,
  );

  return {
    x: best.left,
    y: best.top,
  };
}
