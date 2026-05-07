"use client";

import type { ReactNode } from "react";
import {
  Check,
  Copy,
  Highlighter,
  Sparkles,
  StickyNote,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HIGHLIGHT_COLORS } from "./types";
import type { PdfViewerState } from "./usePdfViewerState";

interface AnnotationToolbarProps {
  canAskAi: boolean;
  viewer: PdfViewerState;
}

export function AnnotationToolbar({
  canAskAi,
  viewer,
}: AnnotationToolbarProps) {
  const {
    askAiFromSelection,
    copiedFlash,
    copySelection,
    noteDraft,
    pendingSelection,
    persistAnnotation,
    popupPosition,
    resetToolbar,
    saveNote,
    setNoteDraft,
    setToolbarMode,
    toolbarMode,
  } = viewer;

  if (!popupPosition || !pendingSelection) return null;

  return (
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
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card px-1 py-1 shadow-lg">
          <ToolbarButton
            icon={<Highlighter className="size-3.5" />}
            label="Highlight"
            active={toolbarMode === "pickHighlight"}
            onClick={() =>
              setToolbarMode((mode) =>
                mode === "pickHighlight" ? "idle" : "pickHighlight",
              )
            }
          />
          <ToolbarButton
            icon={<Underline className="size-3.5" />}
            label="Underline"
            active={toolbarMode === "pickUnderline"}
            onClick={() =>
              setToolbarMode((mode) =>
                mode === "pickUnderline" ? "idle" : "pickUnderline",
              )
            }
          />
          <ToolbarButton
            icon={<StickyNote className="size-3.5" />}
            label="Note"
            active={toolbarMode === "note"}
            onClick={() =>
              setToolbarMode((mode) =>
                mode === "note" ? "idle" : "note",
              )
            }
          />
          <div className="mx-0.5 h-4 w-px bg-border" />
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
          {canAskAi && (
            <ToolbarButton
              icon={<Sparkles className="size-3.5" />}
              label="Ask AI"
              onClick={askAiFromSelection}
            />
          )}
        </div>

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
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                onClick={() =>
                  persistAnnotation(
                    color,
                    toolbarMode === "pickUnderline"
                      ? "underline"
                      : "highlight",
                  )
                }
                title={color.label}
                aria-label={`${color.label} ${
                  toolbarMode === "pickUnderline"
                    ? "underline"
                    : "highlight"
                }`}
                className="size-5 cursor-pointer rounded-full border-2 border-transparent transition-colors hover:border-foreground/40 focus:border-foreground/60 focus:outline-none"
                style={{ background: color.hex }}
              />
            ))}
          </div>
        )}

        {toolbarMode === "note" && (
          <div className="flex w-64 flex-col gap-1.5 rounded-lg border border-border bg-card p-2 shadow-lg">
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
                Cmd/Ctrl+Enter to save
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
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: ReactNode;
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
      className={`flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-ring ${
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
