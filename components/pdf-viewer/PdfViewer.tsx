"use client";

import { pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { PdfDocumentPane } from "./PdfDocumentPane";
import { PdfToolsPanel } from "./PdfToolsPanel";
import { PdfTopBar } from "./PdfTopBar";
import type { PdfViewerProps } from "./types";
import { usePdfViewerState } from "./usePdfViewerState";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export function PdfViewer({
  fileUrl,
  fileName,
  fileId,
  workspaceId,
  userId,
  onClose,
  onSendToChat,
}: PdfViewerProps) {
  const viewer = usePdfViewerState({
    fileId,
    workspaceId,
    userId,
    onSendToChat,
  });
  const canAskAi = Boolean(onSendToChat);

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/40">
      <PdfTopBar fileName={fileName} onClose={onClose} viewer={viewer} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <PdfDocumentPane
          fileUrl={fileUrl}
          canAskAi={canAskAi}
          viewer={viewer}
        />
        <PdfToolsPanel canAskAi={canAskAi} viewer={viewer} />
      </div>
    </div>
  );
}

export type { PdfViewerProps };
