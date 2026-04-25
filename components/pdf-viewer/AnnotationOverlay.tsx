"use client";

import type { DBHighlightSchema } from "@/lib/firebase/schema";

interface AnnotationOverlayProps {
  highlights: DBHighlightSchema[];
  pageSize: { width: number; height: number } | null;
  onAskHighlight: (text: string, note?: string) => void;
}

export function AnnotationOverlay({
  highlights,
  pageSize,
  onAskHighlight,
}: AnnotationOverlayProps) {
  return (
    <>
      {highlights.map((highlight) =>
        highlight.rects.map((rect, index) => {
          const isUnderline = highlight.style === "underline";
          const hasPct =
            typeof rect.xPct === "number" &&
            typeof rect.yPct === "number" &&
            typeof rect.widthPct === "number" &&
            typeof rect.heightPct === "number";
          const left = hasPct && pageSize ? rect.xPct! * pageSize.width : rect.x;
          const top = hasPct && pageSize ? rect.yPct! * pageSize.height : rect.y;
          const width =
            hasPct && pageSize ? rect.widthPct! * pageSize.width : rect.width;
          const height =
            hasPct && pageSize ? rect.heightPct! * pageSize.height : rect.height;

          return (
            <div
              key={`${highlight.id}-${index}`}
              onClick={() => onAskHighlight(highlight.text, highlight.note)}
              title={highlight.note ? `Note: ${highlight.note}` : "Click to ask AI"}
              style={{
                position: "absolute",
                left,
                top,
                width,
                height,
                background: isUnderline ? "transparent" : highlight.color,
                opacity: isUnderline ? 1 : 0.35,
                borderBottom: `2px solid ${highlight.color}`,
                cursor: "pointer",
                pointerEvents: "all",
                mixBlendMode: isUnderline ? "normal" : "multiply",
                zIndex: 10,
              }}
            />
          );
        }),
      )}
    </>
  );
}
