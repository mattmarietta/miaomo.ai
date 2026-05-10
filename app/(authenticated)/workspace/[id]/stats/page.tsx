"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/Auth";
import { subscribeWorkspaceFiles } from "@/lib/firebase/client-queries";
import { DBWorkspaceFileSchema } from "@/lib/firebase/schema";
import { getUserDecks, type Flashcard } from "@/lib/firebase/flashcardStore";
import { getUserQuizzes, type Quiz } from "@/lib/firebase/quizStore";
import {
  getFileMastery,
  getWorkspaceMastery,
  masteryBarColor,
  masteryTextColor,
} from "@/lib/stats/mastery";
import { ArrowLeft, FileText, BarChart3 } from "lucide-react";

export default function WorkspaceStatsPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [files, setFiles] = useState<DBWorkspaceFileSchema[]>([]);
  const [decks, setDecks] = useState<Flashcard[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Subscribe to workspace files (live updates as files come and go)
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeWorkspaceFiles(workspaceId, user.uid, setFiles, () => setFiles([]));
    return () => unsub();
  }, [workspaceId, user]);

  // Load decks/quizzes once on mount. They don't change often during a stats viewing session.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [d, q] = await Promise.all([getUserDecks(user.uid), getUserQuizzes(user.uid)]);
        if (cancelled) return;
        setDecks(d);
        setQuizzes(q);
      } catch (err) {
        console.error("Failed to load stats data:", err);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (authLoading || dataLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (!user) return null;

  const fileIds = files.map((f) => f.id);
  const overall = getWorkspaceMastery(fileIds, decks, quizzes);

  return (
    <main className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/workspace/${workspaceId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="size-4" />
            Back to workspace
          </Link>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="size-6 text-muted-foreground" />
            Statistics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mastery is averaged across quizzes and flashcard decks generated from each file.
          </p>
        </div>

        {/* Overall mastery card */}
        <div className="rounded-xl border border-border bg-card p-6 mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Workspace mastery</h2>
          {overall === null ? (
            <p className="text-sm text-muted-foreground">
              No study tools generated from this workspace yet. Create a quiz or deck from a file to start tracking mastery.
            </p>
          ) : (
            <>
              <div className={`text-4xl font-bold ${masteryTextColor(overall)}`}>{overall}%</div>
              <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all ${masteryBarColor(overall)}`}
                  style={{ width: `${overall}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* Per-file breakdown */}
        <h2 className="text-sm font-medium text-muted-foreground mb-3">By file</h2>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files in this workspace yet.</p>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {files.map((file) => {
              const pct = getFileMastery(file.id, decks, quizzes);
              return (
                <div key={file.id} className="flex items-center gap-4 px-4 py-3">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.originalName}</p>
                    {pct === null ? (
                      <p className="text-xs text-muted-foreground mt-1">Not yet studied</p>
                    ) : (
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full transition-all ${masteryBarColor(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <span className={`text-sm font-medium tabular-nums shrink-0 ${pct === null ? "text-muted-foreground" : masteryTextColor(pct)}`}>
                    {pct === null ? "—" : `${pct}%`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
