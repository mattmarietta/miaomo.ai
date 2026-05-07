"use client";

import { MessageSquareText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DBHighlightSchema } from "@/lib/firebase/schema";
import type { PdfViewerState } from "./usePdfViewerState";

interface PdfToolsPanelProps {
  canAskAi: boolean;
  viewer: PdfViewerState;
}

export function PdfToolsPanel({ canAskAi, viewer }: PdfToolsPanelProps) {
  const {
    currentPage,
    goToPage,
    groupedHighlights,
    highlights,
    removeHighlight,
    sendHighlightToChat,
    sidebarOpen,
  } = viewer;

  if (!sidebarOpen) return null;

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-card min-h-0 lg:flex">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Highlights & Notes
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {highlights.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {highlights.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs leading-relaxed text-muted-foreground">
            Select text in the PDF to highlight, underline, or attach a note.
          </div>
        ) : (
          <div className="flex flex-col">
            {groupedHighlights.map(([page, items]) => (
              <div key={page}>
                <div
                  className={`sticky top-0 z-10 border-b border-border px-3 py-1 text-[10px] font-medium uppercase tracking-wider backdrop-blur ${
                    page === currentPage
                      ? "bg-muted/80 text-foreground"
                      : "bg-card/95 text-muted-foreground"
                  }`}
                >
                  Page {page}
                  {page === currentPage && (
                    <span className="ml-1.5 text-foreground/60 normal-case tracking-normal">
                      current
                    </span>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {items.map((highlight) => (
                    <HighlightCard
                      key={highlight.id}
                      highlight={highlight}
                      canAskAi={canAskAi}
                      onJump={() => goToPage(highlight.pageNumber)}
                      onAskAi={() =>
                        sendHighlightToChat(
                          highlight.text,
                          highlight.note,
                        )
                      }
                      onDelete={() => removeHighlight(highlight.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
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
      className="group cursor-pointer px-3 py-2.5 transition-colors hover:bg-muted/40"
      onClick={onJump}
    >
      <div className="flex items-start gap-2">
        <div
          className="mt-1.5 size-2 shrink-0 rounded-full"
          style={{ background: highlight.color }}
        />
        <div className="min-w-0 flex-1">
          <p
            className="line-clamp-3 text-xs leading-relaxed text-foreground"
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
            <p className="mt-1.5 line-clamp-2 border-l-2 border-border pl-2 text-[11px] italic leading-relaxed text-muted-foreground">
              {highlight.note}
            </p>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
