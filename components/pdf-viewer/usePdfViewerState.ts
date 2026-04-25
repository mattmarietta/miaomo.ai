"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addHighlight,
  deleteHighlight,
  subscribeHighlights,
} from "@/lib/firebase/client-queries";
import type { DBHighlightSchema, HighlightRect } from "@/lib/firebase/schema";
import {
  HIGHLIGHT_COLORS,
  type AnnotationStyle,
  type HighlightColor,
  type PendingSelection,
  type PopupPosition,
  type PdfViewerProps,
  type ToolbarMode,
} from "./types";

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

function clearSelection() {
  window.getSelection()?.removeAllRanges();
}

export function usePdfViewerState({
  fileId,
  workspaceId,
  userId,
  onSendToChat,
}: Pick<PdfViewerProps, "fileId" | "workspaceId" | "userId" | "onSendToChat">) {
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
  const [textLayerEl, setTextLayerEl] = useState<HTMLElement | null>(null);
  const [pageSize, setPageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);

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

  const zoomIn = useCallback(
    () => setScale((prev) => Math.min(prev + 0.1, 3.0)),
    [],
  );
  const zoomOut = useCallback(
    () => setScale((prev) => Math.max(prev - 0.1, 0.5)),
    [],
  );
  const resetZoom = useCallback(() => setScale(1.0), []);

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

  useEffect(() => {
    if (!textLayerEl) return;
    const currentTextLayerEl = textLayerEl;

    function handleMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
      const range = sel.getRangeAt(0);
      if (!currentTextLayerEl.contains(range.commonAncestorContainer)) return;

      const start = getCharOffset(
        currentTextLayerEl,
        range.startContainer,
        range.startOffset,
      );
      const end = getCharOffset(
        currentTextLayerEl,
        range.endContainer,
        range.endOffset,
      );
      const text = sel.toString().trim();

      const wrapperRect = pageContainerRef.current?.getBoundingClientRect();
      if (!wrapperRect) return;

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
      const toolbarBuffer = 80;
      setPopupPosition({
        x: bounding.left - wrapperRect.left + bounding.width / 2,
        y: bounding.top - wrapperRect.top,
        bottom: bounding.bottom - wrapperRect.top,
        placement: spaceAbove < toolbarBuffer ? "below" : "above",
      });
    }

    currentTextLayerEl.addEventListener("mouseup", handleMouseUp);
    return () =>
      currentTextLayerEl.removeEventListener("mouseup", handleMouseUp);
  }, [textLayerEl]);

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
            clearSelection();
          }
          break;
        case "ArrowRight":
          if (numPages && currentPage < numPages) {
            e.preventDefault();
            setCurrentPage((p) => Math.min(numPages, p + 1));
            setTextLayerEl(null);
            clearSelection();
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
    (color: HighlightColor, style: AnnotationStyle, note?: string) => {
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
      clearSelection();
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
    clearSelection();
  }, [pendingSelection, onSendToChat, sendHighlightToChat, resetToolbar]);

  const copySelection = useCallback(async () => {
    if (!pendingSelection) return;
    try {
      await navigator.clipboard.writeText(pendingSelection.text);
      setCopiedFlash(true);
      setTimeout(() => {
        resetToolbar();
        clearSelection();
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
      clearSelection();
    },
    [numPages, resetToolbar],
  );

  const pageHighlights = useMemo(
    () => highlights.filter((h) => h.pageNumber === currentPage),
    [highlights, currentPage],
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

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: nextNumPages }: { numPages: number }) => {
      setNumPages(nextNumPages);
      setLoadError(null);
    },
    [],
  );

  const onDocumentLoadError = useCallback((err: Error) => {
    setLoadError(err?.message || "Unknown error");
  }, []);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setReloadKey((key) => key + 1);
  }, []);

  return {
    askAiFromSelection,
    containerRef,
    containerWidth,
    copiedFlash,
    copySelection,
    currentPage,
    goToPage,
    groupedHighlights,
    highlights,
    loadError,
    noteDraft,
    numPages,
    onDocumentLoadError,
    onDocumentLoadSuccess,
    onPageRenderSuccess,
    pageContainerRef,
    pageHighlights,
    pageInput,
    pageSize,
    pendingSelection,
    persistAnnotation,
    popupPosition,
    reloadKey,
    removeHighlight,
    resetToolbar,
    resetZoom,
    retryLoad,
    saveNote,
    scale,
    scrollContainerRef,
    sendHighlightToChat,
    setNoteDraft,
    setPageInput,
    setSidebarOpen,
    setToolbarMode,
    sidebarOpen,
    toolbarMode,
    zoomIn,
    zoomOut,
  };
}

export type PdfViewerState = ReturnType<typeof usePdfViewerState>;
