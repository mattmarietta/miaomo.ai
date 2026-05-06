"use client";

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
