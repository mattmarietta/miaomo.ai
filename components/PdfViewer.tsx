"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  Underline,
  StickyNote,
  Copy,
  Sparkles,
  ZoomIn,
  ZoomOut,
  PanelRightOpen,
  PanelRightClose,
  Check,
  RotateCw,
  AlertTriangle,
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

type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];
type AnnotationStyle = "highlight" | "underline";
type ToolbarMode = "idle" | "pickHighlight" | "pickUnderline" | "note";

interface PendingSelection {
  start: number;
  end: number;
  text: string;
  rects: HighlightRect[];
}

interface PopupPosition {
  x: number;
  y: number;
  bottom: number;
  placement: "above" | "below";
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
  const [toolbarMode, setToolbarMode] = useState<ToolbarMode>("idle");
  const [noteDraft, setNoteDraft] = useState("");
  const [copiedFlash, setCopiedFlash] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [scale, setScale] = useState(1.0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pageInput, setPageInput] = useState("1");

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const [textLayerEl, setTextLayerEl] = useState<HTMLElement | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

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
    setHighlights([]);
    if (!workspaceId || !fileId || !userId) return;
    console.debug("[PdfViewer] subscribe highlights", {
      workspaceId,
      fileId,
      userId,
    });
    const unsub = subscribeHighlights(
      workspaceId,
      fileId,
      userId,
      setHighlights,
    );
    return () => unsub();
  }, [workspaceId, fileId, userId]);

  const onPageRenderSuccess = useCallback(() => {
    const el = pageContainerRef.current?.querySelector(
      ".react-pdf__Page__textContent",
    );
    setTextLayerEl((el as HTMLElement) ?? null);

    const wrapper = pageContainerRef.current?.getBoundingClientRect();
    if (wrapper && wrapper.width > 0 && wrapper.height > 0) {
      setPageSize({ width: wrapper.width, height: wrapper.height });
    }
  }, []);

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.1, 3.0));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.5));
  const resetZoom = () => setScale(1.0);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const resetToolbar = useCallback(() => {
    setPopupPosition(null);
    setPendingSelection(null);
    setToolbarMode("idle");
    setNoteDraft("");
    setCopiedFlash(false);
  }, []);

  // Text selection handler — captures selection, rects, and popup position.
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

      const wrapperRect = pageContainerRef.current?.getBoundingClientRect();
      if (!wrapperRect) return;


      // get the width and height to match the scale

      const pageW = wrapperRect.width || 1;
      const pageH = wrapperRect.height || 1;

      const rects = Array.from(range.getClientRects()).map(
        (r): HighlightRect => {
          const x = r.left - wrapperRect.left;
          const y = r.top - wrapperRect.top;
          return {
            x,
            y,
            width: r.width,
            height: r.height,
            xPct: x / pageW,
            yPct: y / pageH,
            widthPct: r.width / pageW,
            heightPct: r.height / pageH,
          };
        },
      );

      setPendingSelection({ start, end, text, rects });
      setToolbarMode("idle");
      setNoteDraft("");

      const bounding = range.getBoundingClientRect();
      const scrollRect = scrollContainerRef.current?.getBoundingClientRect();
      const spaceAbove = scrollRect
        ? bounding.top - scrollRect.top
        : bounding.top;
      const TOOLBAR_BUFFER = 80;
      setPopupPosition({
        x: bounding.left - wrapperRect.left + bounding.width / 2,
        y: bounding.top - wrapperRect.top,
        bottom: bounding.bottom - wrapperRect.top,
        placement: spaceAbove < TOOLBAR_BUFFER ? "below" : "above",
      });
    }

    textLayerEl.addEventListener("mouseup", handleMouseUp);
    return () => textLayerEl.removeEventListener("mouseup", handleMouseUp);
  }, [textLayerEl]);

  // Dismiss toolbar when user clicks outside or presses Escape.
  useEffect(() => {
    if (!popupPosition) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") resetToolbar();
    }
    function handleDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-annotation-toolbar]")) return;
      if (target.closest(".react-pdf__Page__textContent")) return;
      resetToolbar();
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleDown);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleDown);
    };
  }, [popupPosition, resetToolbar]);

  // Global keyboard shortcuts: page nav, zoom, reset zoom.
  // Disabled while typing in inputs/textareas or while the note editor is open.
  useEffect(() => {
    function isEditableTarget(el: EventTarget | null) {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    }

    function handleKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      if (toolbarMode === "note") return;

      switch (e.key) {
        case "ArrowLeft":
          if (currentPage > 1) {
            e.preventDefault();
            setCurrentPage((p) => Math.max(1, p - 1));
            setTextLayerEl(null);
            window.getSelection()?.removeAllRanges();
          }
          break;
        case "ArrowRight":
          if (numPages && currentPage < numPages) {
            e.preventDefault();
            setCurrentPage((p) => Math.min(numPages, p + 1));
            setTextLayerEl(null);
            window.getSelection()?.removeAllRanges();
          }
          break;
        case "+":
        case "=":
          e.preventDefault();
          setScale((prev) => Math.min(prev + 0.1, 3.0));
          break;
        case "-":
        case "_":
          e.preventDefault();
          setScale((prev) => Math.max(prev - 0.1, 0.5));
          break;
        case "0":
          e.preventDefault();
          setScale(1.0);
          break;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentPage, numPages, toolbarMode]);

  const persistAnnotation = useCallback(
    (
      color: HighlightColor,
      style: AnnotationStyle,
      note?: string,
    ) => {
      if (!pendingSelection) return;

      const highlight: DBHighlightSchema = {
        id: crypto.randomUUID(),
        documentId: fileId,
        fileId,
        userId,
        pageNumber: currentPage,
        start: pendingSelection.start,
        end: pendingSelection.end,
        text: pendingSelection.text,
        color: color.hex,
        rects: pendingSelection.rects,
        createdAt: new Date().toISOString(),
        style,
        ...(note ? { note } : {}),
      };

      setHighlights((prev) => [...prev, highlight]);
      addHighlight(workspaceId, fileId, highlight).catch(console.error);

      const sel = window.getSelection();
      sel?.removeAllRanges();
      resetToolbar();
    },
    [pendingSelection, currentPage, fileId, userId, workspaceId, resetToolbar],
  );

  const removeHighlight = useCallback(
    (highlightId: string) => {
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
      deleteHighlight(workspaceId, fileId, highlightId).catch(console.error);
    },
    [workspaceId, fileId],
  );

  const sendHighlightToChat = useCallback(
    (highlightedText: string, note?: string) => {
      if (!onSendToChat) return;
      const body = note
        ? `The user highlighted this passage from the document:\n\n"${highlightedText}"\n\nTheir note: "${note}"\n\nPlease explain it in relation to the document and the note.`
        : `The user highlighted this passage from the document:\n\n"${highlightedText}"\n\nPlease explain it in relation to the document.`;
      onSendToChat(body);
    },
    [onSendToChat],
  );

  const askAiFromSelection = useCallback(() => {
    if (!pendingSelection || !onSendToChat) return;
    sendHighlightToChat(pendingSelection.text);
    resetToolbar();
    window.getSelection()?.removeAllRanges();
  }, [pendingSelection, onSendToChat, sendHighlightToChat, resetToolbar]);

  const copySelection = useCallback(async () => {
    if (!pendingSelection) return;
    try {
      await navigator.clipboard.writeText(pendingSelection.text);
      setCopiedFlash(true);
      setTimeout(() => {
        resetToolbar();
        window.getSelection()?.removeAllRanges();
      }, 1100);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }, [pendingSelection, resetToolbar]);

  const saveNote = useCallback(() => {
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    persistAnnotation(HIGHLIGHT_COLORS[0], "highlight", trimmed);
  }, [noteDraft, persistAnnotation]);

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, numPages || page));
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      resetToolbar();
      setTextLayerEl(null);
      window.getSelection()?.removeAllRanges();
    },
    [numPages, resetToolbar],
  );

  const pageHighlights = highlights.filter(
    (h) => h.pageNumber === currentPage,
  );

  const groupedHighlights = useMemo(() => {
    const groups = new Map<number, DBHighlightSchema[]>();
    for (const h of highlights) {
      const arr = groups.get(h.pageNumber) ?? [];
      arr.push(h);
      groups.set(h.pageNumber, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [highlights]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-muted/40">
      {/* Minimal top toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 h-11 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium truncate">
            {fileName || "Document"}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous page (←)"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <input
              type="text"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) =>
                setPageInput(e.target.value.replace(/[^0-9]/g, ""))
              }
              onFocus={(e) => e.currentTarget.select()}
              onBlur={() => {
                const n = parseInt(pageInput, 10);
                if (!isNaN(n) && n !== currentPage) goToPage(n);
                else setPageInput(String(currentPage));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setPageInput(String(currentPage));
                  e.currentTarget.blur();
                }
              }}
              disabled={!numPages}
              aria-label="Current page"
              className="w-8 h-6 text-center rounded border border-transparent bg-transparent hover:border-border focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
            />
            <span>/</span>
            <span className="min-w-[1.5rem] text-center">
              {numPages || "–"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            title="Next page (→)"
            aria-label="Next page"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1 shrink-0 flex-1 justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={zoomOut}
            title="Zoom out (−)"
            aria-label="Zoom out"
          >
            <ZoomOut className="size-3.5" />
          </Button>
          <button
            type="button"
            onClick={resetZoom}
            title="Reset zoom to 100% (0)"
            aria-label="Reset zoom"
            className="text-[10px] text-muted-foreground tabular-nums w-10 h-6 text-center rounded hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {Math.round(scale * 100)}%
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={zoomIn}
            title="Zoom in (+)"
            aria-label="Zoom in"
          >
            <ZoomIn className="size-3.5" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => setSidebarOpen((s) => !s)}
            title={sidebarOpen ? "Hide highlights" : "Show highlights"}
            aria-label={sidebarOpen ? "Hide highlights panel" : "Show highlights panel"}
            aria-pressed={sidebarOpen}
          >
            {sidebarOpen ? (
              <PanelRightClose className="size-3.5" />
            ) : (
              <PanelRightOpen className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={onClose}
            title="Close"
            aria-label="Close PDF viewer"
          >
            <X className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Body: PDF workspace + right panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* PDF workspace (center) */}
        <div
          ref={containerRef}
          className="flex-1 min-w-0 flex flex-col min-h-0 relative"
        >
          <div ref={scrollContainerRef} className="flex-1 overflow-auto py-6">
            <div
              ref={pageContainerRef}
              className="relative mx-auto shadow-md rounded-sm bg-white"
              style={{ width: "fit-content" }}
            >
              <Document
                key={reloadKey}
                file={fileUrl}
                onLoadSuccess={({ numPages: n }) => {
                  setNumPages(n);
                  setLoadError(null);
                }}
                onLoadError={(err) =>
                  setLoadError(err?.message || "Unknown error")
                }
                loading={
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex items-center justify-center py-20 px-10"
                  >
                    <p className="text-sm text-muted-foreground">
                      Loading PDF...
                    </p>
                  </div>
                }
                error={
                  <div
                    role="alert"
                    className="flex flex-col items-center justify-center gap-3 py-20 px-10"
                  >
                    <AlertTriangle className="size-8 text-destructive" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-destructive">
                        Failed to load PDF
                      </p>
                      {loadError && (
                        <p className="mt-1 text-xs text-muted-foreground max-w-xs truncate">
                          {loadError}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLoadError(null);
                        setReloadKey((k) => k + 1);
                      }}
                      className="gap-1.5"
                    >
                      <RotateCw className="size-3.5" />
                      Try again
                    </Button>
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  width={Math.max(containerWidth - 96, 320)}
                  scale={scale}
                  onRenderSuccess={onPageRenderSuccess}
                />
              </Document>

              {/* Annotation overlays for current page */}
              {pageHighlights.map((h) =>
                h.rects.map((r, i) => {
                  const isUnderline = h.style === "underline";
                  const hasPct =
                    typeof r.xPct === "number" &&
                    typeof r.yPct === "number" &&
                    typeof r.widthPct === "number" &&
                    typeof r.heightPct === "number";
                  const left = hasPct && pageSize ? r.xPct! * pageSize.width : r.x;
                  const top = hasPct && pageSize ? r.yPct! * pageSize.height : r.y;
                  const width =
                    hasPct && pageSize ? r.widthPct! * pageSize.width : r.width;
                  const height =
                    hasPct && pageSize ? r.heightPct! * pageSize.height : r.height;
                  return (
                    <div
                      key={`${h.id}-${i}`}
                      onClick={() => sendHighlightToChat(h.text, h.note)}
                      title={h.note ? `Note: ${h.note}` : "Click to ask AI"}
                      style={{
                        position: "absolute",
                        left,
                        top,
                        width,
                        height,
                        background: isUnderline ? "transparent" : h.color,
                        opacity: isUnderline ? 1 : 0.35,
                        borderBottom: `2px solid ${h.color}`,
                        cursor: "pointer",
                        pointerEvents: "all",
                        mixBlendMode: isUnderline ? "normal" : "multiply",
                        zIndex: 10,
                      }}
                    />
                  );
                }),
              )}

              {/* Floating annotation toolbar */}
              {popupPosition && pendingSelection && (
                <div
                  data-annotation-toolbar
                  role="toolbar"
                  aria-label="Annotation tools"
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute z-50"
                  style={{
                    left: popupPosition.x,
                    top:
                      popupPosition.placement === "above"
                        ? popupPosition.y - 12
                        : popupPosition.bottom + 12,
                    transform:
                      popupPosition.placement === "above"
                        ? "translate(-50%, -100%)"
                        : "translate(-50%, 0)",
                  }}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    {/* Primary action row */}
                    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card px-1 py-1 shadow-lg">
                      <ToolbarButton
                        icon={<Highlighter className="size-3.5" />}
                        label="Highlight"
                        active={toolbarMode === "pickHighlight"}
                        onClick={() =>
                          setToolbarMode((m) =>
                            m === "pickHighlight" ? "idle" : "pickHighlight",
                          )
                        }
                      />
                      <ToolbarButton
                        icon={<Underline className="size-3.5" />}
                        label="Underline"
                        active={toolbarMode === "pickUnderline"}
                        onClick={() =>
                          setToolbarMode((m) =>
                            m === "pickUnderline" ? "idle" : "pickUnderline",
                          )
                        }
                      />
                      <ToolbarButton
                        icon={<StickyNote className="size-3.5" />}
                        label="Note"
                        active={toolbarMode === "note"}
                        onClick={() =>
                          setToolbarMode((m) => (m === "note" ? "idle" : "note"))
                        }
                      />
                      <div className="w-px h-4 bg-border mx-0.5" />
                      <ToolbarButton
                        icon={
                          copiedFlash ? (
                            <Check className="size-3.5 text-green-500" />
                          ) : (
                            <Copy className="size-3.5" />
                          )
                        }
                        label={copiedFlash ? "Copied" : "Copy"}
                        onClick={copySelection}
                      />
                      {onSendToChat && (
                        <ToolbarButton
                          icon={<Sparkles className="size-3.5" />}
                          label="Ask AI"
                          onClick={askAiFromSelection}
                        />
                      )}
                    </div>

                    {/* Contextual sub-row: color picker */}
                    {(toolbarMode === "pickHighlight" ||
                      toolbarMode === "pickUnderline") && (
                      <div
                        className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 shadow-lg"
                        role="radiogroup"
                        aria-label={
                          toolbarMode === "pickUnderline"
                            ? "Pick underline color"
                            : "Pick highlight color"
                        }
                      >
                        {HIGHLIGHT_COLORS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() =>
                              persistAnnotation(
                                c,
                                toolbarMode === "pickUnderline"
                                  ? "underline"
                                  : "highlight",
                              )
                            }
                            title={c.label}
                            aria-label={`${c.label} ${
                              toolbarMode === "pickUnderline"
                                ? "underline"
                                : "highlight"
                            }`}
                            className="size-5 rounded-full border-2 border-transparent hover:border-foreground/40 focus:border-foreground/60 focus:outline-none transition-colors cursor-pointer"
                            style={{ background: c.hex }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Contextual sub-row: note input */}
                    {toolbarMode === "note" && (
                      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2 shadow-lg w-64">
                        <textarea
                          autoFocus
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              saveNote();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              e.stopPropagation();
                              resetToolbar();
                            }
                          }}
                          placeholder="Add a note..."
                          aria-label="Note text"
                          rows={3}
                          className="w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            ⌘/Ctrl+Enter to save
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={resetToolbar}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={saveNote}
                              disabled={!noteDraft.trim()}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible right panel: Highlights & Notes */}
        {sidebarOpen && (
          <aside className="w-72 border-l border-border bg-card flex flex-col min-h-0 shrink-0">
            <div className="flex items-center justify-between px-3 h-10 border-b border-border shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Highlights & Notes
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {highlights.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {highlights.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-muted-foreground leading-relaxed">
                  Select text in the PDF to highlight, underline, or attach a
                  note.
                </div>
              ) : (
                <div className="flex flex-col">
                  {groupedHighlights.map(([page, items]) => (
                    <div key={page}>
                      <div
                        className={`sticky top-0 z-10 px-3 py-1 backdrop-blur border-b border-border text-[10px] font-medium uppercase tracking-wider ${
                          page === currentPage
                            ? "bg-muted/80 text-foreground"
                            : "bg-card/95 text-muted-foreground"
                        }`}
                      >
                        Page {page}
                        {page === currentPage && (
                          <span className="ml-1.5 text-foreground/60 normal-case tracking-normal">
                            · current
                          </span>
                        )}
                      </div>
                      <div className="divide-y divide-border">
                        {items.map((h) => (
                          <HighlightCard
                            key={h.id}
                            highlight={h}
                            canAskAi={!!onSendToChat}
                            onJump={() => goToPage(h.pageNumber)}
                            onAskAi={() =>
                              sendHighlightToChat(h.text, h.note)
                            }
                            onDelete={() => removeHighlight(h.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active ?? false}
      className={`flex items-center gap-1 h-7 px-2 rounded-md text-xs transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function HighlightCard({
  highlight,
  canAskAi,
  onJump,
  onAskAi,
  onDelete,
}: {
  highlight: DBHighlightSchema;
  canAskAi: boolean;
  onJump: () => void;
  onAskAi: () => void;
  onDelete: () => void;
}) {
  const isUnderline = highlight.style === "underline";
  return (
    <div
      className="group px-3 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
      onClick={onJump}
    >
      <div className="flex items-start gap-2">
        <div
          className="mt-1.5 size-2 rounded-full shrink-0"
          style={{ background: highlight.color }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-xs text-foreground line-clamp-3 leading-relaxed"
            style={
              isUnderline
                ? {
                    textDecoration: "underline",
                    textDecorationColor: highlight.color,
                    textDecorationThickness: 2,
                  }
                : {
                    background: `${highlight.color}59`,
                    padding: "0 2px",
                    borderRadius: 2,
                  }
            }
          >
            {highlight.text}
          </p>
          {highlight.note && (
            <p className="mt-1.5 text-[11px] text-muted-foreground italic line-clamp-2 leading-relaxed border-l-2 border-border pl-2">
              {highlight.note}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {canAskAi && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onAskAi();
            }}
            title="Ask AI about this"
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
            onDelete();
          }}
          title="Remove"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}
