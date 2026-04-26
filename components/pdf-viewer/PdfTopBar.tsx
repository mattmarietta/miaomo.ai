"use client";

import {
  ChevronLeft,
  ChevronRight,
  FileText,
  PanelRightClose,
  PanelRightOpen,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PdfViewerState } from "./usePdfViewerState";

interface PdfTopBarProps {
  fileName: string;
  onClose: () => void;
  viewer: PdfViewerState;
}

export function PdfTopBar({ fileName, onClose, viewer }: PdfTopBarProps) {
  const {
    currentPage,
    goToPage,
    numPages,
    pageInput,
    resetZoom,
    scale,
    setPageInput,
    setSidebarOpen,
    sidebarOpen,
    zoomIn,
    zoomOut,
  } = viewer;

  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium">
          {fileName || "Document"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Previous page (left arrow)"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <div className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
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
            className="h-6 w-8 rounded border border-transparent bg-transparent text-center tabular-nums hover:border-border focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span>/</span>
          <span className="min-w-[1.5rem] text-center">
            {numPages || "-"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= numPages}
          title="Next page (right arrow)"
          aria-label="Next page"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-1 shrink-0 items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7"
          onClick={zoomOut}
          title="Zoom out (-)"
          aria-label="Zoom out"
        >
          <ZoomOut className="size-3.5" />
        </Button>
        <button
          type="button"
          onClick={resetZoom}
          title="Reset zoom to 100% (0)"
          aria-label="Reset zoom"
          className="h-6 w-10 rounded text-center text-[10px] tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7"
          onClick={() => setSidebarOpen((open) => !open)}
          title={sidebarOpen ? "Hide highlights" : "Show highlights"}
          aria-label={
            sidebarOpen ? "Hide highlights panel" : "Show highlights panel"
          }
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
  );
}
