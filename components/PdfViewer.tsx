"use client";

import dynamic from "next/dynamic";

export const PdfViewer = dynamic(
  () => import("./pdf-viewer/PdfViewer").then((mod) => mod.PdfViewer),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-10"><p className="text-sm text-muted-foreground">Loading PDF viewer...</p></div> },
);

export type { PdfViewerProps } from "./pdf-viewer/PdfViewer";
