"use client";

import { useCallback } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Document, Page } from "react-pdf";
import { Button } from "@/components/ui/button";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { AnnotationToolbar } from "./AnnotationToolbar";
import type { PdfViewerState } from "./usePdfViewerState";

interface PdfDocumentPaneProps {
  fileUrl: string;
  canAskAi: boolean;
  viewer: PdfViewerState;
}

export function PdfDocumentPane({
  fileUrl,
  canAskAi,
  viewer,
}: PdfDocumentPaneProps) {
  const {
    citationHighlight,
    containerRef,
    containerWidth,
    currentPage,
    loadError,
    onDocumentLoadError,
    onDocumentLoadSuccess,
    onPageRenderSuccess,
    pageContainerRef,
    pageHighlights,
    pageSize,
    reloadKey,
    retryLoad,
    scale,
    scrollContainerRef,
    sendHighlightToChat,
  } = viewer;

  const customTextRenderer = useCallback(
    (textItem: { str: string; itemIndex: number }) => {
      if (!citationHighlight) return textItem.str;
      const normHighlight = citationHighlight.replace(/\s+/g, " ").trim().toLowerCase();
      const normStr = textItem.str.toLowerCase();
      if (normHighlight.length < 10) return textItem.str;
      // Check if this text item overlaps with the highlight
      const idx = normHighlight.indexOf(normStr);
      const idx2 = normStr.indexOf(normHighlight.slice(0, Math.min(40, normHighlight.length)));
      if (idx >= 0 || idx2 >= 0) {
        return `<mark style="background:oklch(0.85 0.15 163 / 0.4);color:transparent;border-radius:2px;padding:0 1px;">${textItem.str}</mark>`;
      }
      return textItem.str;
    },
    [citationHighlight],
  );

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto px-6 py-6"
      >
        <div
          ref={pageContainerRef}
          className="relative mx-auto rounded-sm bg-white shadow-md"
          style={{ width: "fit-content" }}
        >
          <Document
            key={reloadKey}
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-center px-10 py-20"
              >
                <p className="text-sm text-muted-foreground">Loading PDF...</p>
              </div>
            }
            error={
              <div
                role="alert"
                className="flex flex-col items-center justify-center gap-3 px-10 py-20"
              >
                <AlertTriangle className="size-8 text-destructive" />
                <div className="text-center">
                  <p className="text-sm font-medium text-destructive">
                    Failed to load PDF
                  </p>
                  {loadError && (
                    <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
                      {loadError}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={retryLoad}
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
              customTextRenderer={citationHighlight ? customTextRenderer : undefined}
            />
          </Document>

          <AnnotationOverlay
            highlights={pageHighlights}
            pageSize={pageSize}
            onAskHighlight={sendHighlightToChat}
          />
          <AnnotationToolbar canAskAi={canAskAi} viewer={viewer} />
        </div>
      </div>
    </div>
  );
}
