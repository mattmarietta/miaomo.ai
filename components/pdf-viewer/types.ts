"use client";

import type { DBHighlightSchema, HighlightRect } from "@/lib/firebase/schema";

export const HIGHLIGHT_COLORS = [
  { id: "yellow", hex: "#facc15", label: "Yellow" },
  { id: "green", hex: "#4ade80", label: "Green" },
  { id: "blue", hex: "#60a5fa", label: "Blue" },
  { id: "pink", hex: "#f472b6", label: "Pink" },
] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];
export type AnnotationStyle = "highlight" | "underline";
export type ToolbarMode = "idle" | "pickHighlight" | "pickUnderline" | "note";

export interface PendingSelection {
  start: number;
  end: number;
  text: string;
  rects: HighlightRect[];
}

export interface PopupPosition {
  x: number;
  y: number;
  bottom: number;
  placement: "above" | "below";
}

export interface PdfViewerProps {
  fileUrl: string;
  fileName: string;
  fileId: string;
  workspaceId: string;
  userId: string;
  onClose: () => void;
  onSendToChat?: (text: string) => void;
}

export type HighlightGroup = [page: number, highlights: DBHighlightSchema[]];
