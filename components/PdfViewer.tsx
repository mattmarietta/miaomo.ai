"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Trash2,
  MessageSquareText,
  Highlighter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addHighlight,
  deleteHighlight,
  subscribeHighlights,
} from "@/lib/firebase/client-queries";
import type { DBHighlightSchema, HighlightRect } from "@/lib/firebase/schema";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const HIGHLIGHT_COLORS = [
  { id: "yellow", hex: "#facc15", label: "Yellow" },
  { id: "green", hex: "#4ade80", label: "Green" },
  { id: "blue", hex: "#60a5fa", label: "Blue" },
  { id: "pink", hex: "#f472b6", label: "Pink" },
] as const;

interface PendingSelection {
  start: number;
  end: number;
  text: string;
}

interface PopupPosition {
  x: number;
  y: number;
}

interface PdfViewerProps {
  fileUrl: string;
  fileName: string;
  fileId: string;
  workspaceId: string;
  userId: string;
  onClose: () => void;
  onSendToChat?: (text: string) => void;
}

function getCharOffset(
  container: HTMLElement,
  targetNode: Node,
  offsetInNode: number,
): number {
  let total = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode === targetNode) return total + offsetInNode;
    total += walker.currentNode.textContent?.length ?? 0;
  }
  return total;
}

export function PdfViewer({
  fileUrl,
  fileName,
  fileId,
  workspaceId,
  userId,
  onClose,
  onSendToChat,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [containerWidth, setContainerWidth] = useState(600);
  const [highlights, setHighlights] = useState<DBHighlightSchema[]>([]);
  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(
    null,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const [textLayerEl, setTextLayerEl] = useState<HTMLElement | null>(null);

  // Measure container width for responsive PDF scaling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Subscribe to highlights from Firestore
  useEffect(() => {
    if (!workspaceId || !fileId || !userId) return;
    const unsub = subscribeHighlights(
      workspaceId,
      fileId,
      userId,
      setHighlights,
    );
    return () => unsub();
  }, [workspaceId, fileId, userId]);

  // Grab text layer element after page renders — using state so the
  // mouseup effect re-runs when the element actually appears in the DOM.
  const onPageRenderSuccess = useCallback(() => {
    const el = pageContainerRef.current?.querySelector(
      ".react-pdf__Page__textContent",
    );
    setTextLayerEl(el as HTMLElement ?? null);
  }, []);

  // Text selection handler scoped to text layer.
  // Depends on textLayerEl (state) so it re-attaches when the element appears.
  useEffect(() => {
    if (!textLayerEl) return;

    function handleMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
      const range = sel.getRangeAt(0);
      if (!textLayerEl!.contains(range.commonAncestorContainer)) return;

      const start = getCharOffset(
        textLayerEl!,
        range.startContainer,
        range.startOffset,
      );
      const end = getCharOffset(
        textLayerEl!,
        range.endContainer,
        range.endOffset,
      );
      const text = sel.toString().trim();

      setPendingSelection({ start, end, text });

      // Compute position relative to pageContainerRef (the positioning context)
      const rect = range.getBoundingClientRect();
      const wrapperRect = pageContainerRef.current?.getBoundingClientRect();
      if (!wrapperRect) return;
      setPopupPosition({
        x: rect.left - wrapperRect.left + rect.width / 2,
        y: rect.top - wrapperRect.top,
      });
    }

    textLayerEl.addEventListener("mouseup", handleMouseUp);
    return () => textLayerEl.removeEventListener("mouseup", handleMouseUp);
  }, [textLayerEl]);

  const applyHighlight = useCallback(
    (color: (typeof HIGHLIGHT_COLORS)[number]) => {
      if (!pendingSelection) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const wrapperRect = pageContainerRef.current?.getBoundingClientRect();
      if (!wrapperRect) return;

      const rects = Array.from(range.getClientRects());

      const highlight: DBHighlightSchema = {
        id: crypto.randomUUID(),
        documentId: fileId,
        userId,
        pageNumber: currentPage,
        start: pendingSelection.start,
        end: pendingSelection.end,
        text: pendingSelection.text,
        color: color.hex,
        rects: rects.map(
          (r): HighlightRect => ({
            x: r.left - wrapperRect.left,
            y: r.top - wrapperRect.top,
            width: r.width,
            height: r.height,
          }),
        ),
        createdAt: new Date().toISOString(),
      };

      setHighlights((prev) => [...prev, highlight]);
      addHighlight(workspaceId, fileId, highlight).catch(console.error);
      setPopupPosition(null);
      setPendingSelection(null);
      sel.removeAllRanges();
    },
    [pendingSelection, currentPage, fileId, userId, workspaceId],
  );

  const removeHighlight = useCallback(
    (highlightId: string) => {
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
      deleteHighlight(workspaceId, fileId, highlightId).catch(console.error);
    },
    [workspaceId, fileId],
  );

  const sendHighlightToChat = useCallback(
    (highlightedText: string) => {
      if (!onSendToChat) return;
      const prompt =
        `The user highlighted this passage from the document:\n\n` +
        `"${highlightedText}"\n\n` +
        `Please explain it in relation to the document.`;
      onSendToChat(prompt);
    },
    [onSendToChat],
  );

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, numPages)));
      setPopupPosition(null);
      setPendingSelection(null);
      setTextLayerEl(null);
    },
    [numPages],
  );

  const pageHighlights = highlights.filter(
    (h) => h.pageNumber === currentPage,
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium truncate">
            {fileName || "Document"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle highlights"
          >
            <Highlighter className="size-3.5" />
          </Button>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Body: PDF + optional sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* PDF Area */}
        <div ref={containerRef} className="flex-1 min-w-0 flex flex-col min-h-0">
          {/* Page controls */}
          <div className="flex items-center justify-center gap-2 px-3 py-1.5 border-b border-border bg-card/50 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {currentPage} / {numPages || "–"}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          {/* PDF canvas */}
          <div className="flex-1 overflow-auto">
            <div
              ref={pageContainerRef}
              className="relative mx-auto"
              style={{ width: "fit-content" }}
            >
              <Document
                file={fileUrl}
                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                loading={
                  <div className="flex items-center justify-center py-20">
                    <p className="text-sm text-muted-foreground">
                      Loading PDF...
                    </p>
                  </div>
                }
                error={
                  <div className="flex items-center justify-center py-20">
                    <p className="text-sm text-destructive">
                      Failed to load PDF.
                    </p>
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  width={containerWidth - 32}
                  onRenderSuccess={onPageRenderSuccess}
                />
              </Document>

              {/* Highlight overlays */}
              {pageHighlights.map((h) =>
                h.rects.map((r, i) => (
                  <div
                    key={`${h.id}-${i}`}
                    onClick={() => sendHighlightToChat(h.text)}
                    title="Click to explain in chat"
                    style={{
                      position: "absolute",
                      left: r.x,
                      top: r.y,
                      width: r.width,
                      height: r.height,
                      background: h.color,
                      opacity: 0.35,
                      borderBottom: `2px solid ${h.color}`,
                      cursor: "pointer",
                      pointerEvents: "all",
                      mixBlendMode: "multiply",
                      zIndex: 10,
                    }}
                  />
                )),
              )}

              {/* Color picker popup */}
              {popupPosition && pendingSelection && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute z-50 flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 shadow-lg"
                  style={{
                    left: popupPosition.x,
                    top: popupPosition.y - 48,
                    transform: "translateX(-50%)",
                  }}
                >
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => applyHighlight(c)}
                      title={c.label}
                      className="size-6 rounded-full border-2 border-transparent hover:border-foreground/30 transition-colors"
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Highlights sidebar */}
        {sidebarOpen && (
          <div className="w-32 border-l border-border bg-card flex flex-col min-h-0 shrink-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Highlights
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {highlights.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {highlights.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Select text in the PDF to add highlights
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {highlights.map((h) => (
                    <div
                      key={h.id}
                      className="group px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => goToPage(h.pageNumber)}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="mt-1 size-2.5 rounded-full shrink-0"
                          style={{ background: h.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                            {h.text}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Page {h.pageNumber}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onSendToChat && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendHighlightToChat(h.text);
                            }}
                            title="Explain in chat"
                          >
                            <MessageSquareText className="size-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeHighlight(h.id);
                          }}
                          title="Remove highlight"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
