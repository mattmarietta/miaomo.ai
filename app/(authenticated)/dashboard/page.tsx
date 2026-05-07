"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/Auth";
import {
  subscribeWorkspacesByUserId,
  subscribeWorkspaceFiles,
  subscribeWorkspaceChats,
  createWorkspace,
  deleteWorkspace,
} from "@/lib/firebase/client-queries";
import {
  DBWorkspaceSchema,
  DBWorkspaceFileSchema,
  DBChatSchema,
} from "@/lib/firebase/schema";
import { Plus, FolderOpen, Clock, FileText, MessageSquare, Sparkles, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function WorkspaceCard({
  workspace,
  userId,
  onClick,
  onDeleteRequest,
}: {
  workspace: DBWorkspaceSchema;
  userId: string;
  onClick: () => void;
  onDeleteRequest: () => void;
}) {
  const [files, setFiles] = useState<DBWorkspaceFileSchema[]>([]);
  const [chats, setChats] = useState<DBChatSchema[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubFiles = subscribeWorkspaceFiles(workspace.id, userId, setFiles, () => setFiles([]));
    const unsubChats = subscribeWorkspaceChats(workspace.id, userId, setChats, () => setChats([]));
    return () => {
      unsubFiles();
      unsubChats();
    };
  }, [workspace.id, userId]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const recentFileNames = files.slice(0, 3).map((f) => f.originalName);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="group relative flex flex-col items-start gap-3 rounded-xl border border-border bg-card overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="h-1 w-full bg-primary" />

      {/* Kebab menu — only visible on card hover */}
      <div
        ref={menuRef}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Workspace options"
        >
          <MoreHorizontal className="size-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-8 w-44 rounded-lg border border-border bg-card shadow-md py-1 z-20">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDeleteRequest();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="size-3.5" />
              Delete workspace
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 px-5 pb-5 pt-3 w-full">
        <div className="rounded-lg bg-primary/10 p-2.5 w-fit">
          <FolderOpen className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0 w-full">
          <h3 className="font-medium text-foreground truncate pr-6">
            {workspace.title || "Untitled Workspace"}
          </h3>
          {recentFileNames.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {recentFileNames.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  <FileText className="size-2.5" />
                  <span className="truncate max-w-[100px]">{name}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border/50">
          <div className="flex items-center gap-1">
            <FileText className="size-3" />
            <span>
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="size-3" />
            <span>
              {chats.length} {chats.length === 1 ? "chat" : "chats"}
            </span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Clock className="size-3" />
            <span>{formatDate(workspace.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [workspaces, setWorkspaces] = useState<DBWorkspaceSchema[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DBWorkspaceSchema | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const unsub = subscribeWorkspacesByUserId(user.uid, setWorkspaces);
    return () => unsub();
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting...</p>
      </main>
    );
  }

  const handleCreateWorkspace = async () => {
    const id = await createWorkspace(user.uid, "Untitled Workspace");
    router.push(`/workspace/${id}`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteWorkspace(deleteTarget.id, user.uid);
    } catch (err) {
      console.error("Failed to delete workspace:", err);
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {getGreeting()}, {user.displayName || user.email || "there"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Here&apos;s an overview of your workspaces
            </p>
          </div>
          <Button onClick={handleCreateWorkspace} className="gap-2">
            <Plus className="size-4" />
            New Workspace
          </Button>
        </div>

        {/* Workspaces Grid */}
        <div className="mb-4">
          <h2 className="text-lg font-medium text-foreground">
            Your Workspaces
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Create New */}
          <button
            onClick={handleCreateWorkspace}
            className="group flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-8 hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer min-h-[200px]"
          >
            <div className="rounded-full bg-muted p-3 group-hover:bg-primary/10 transition-colors">
              <Plus className="size-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              New Workspace
            </span>
            <span className="text-[12px] text-muted-foreground/60 text-center leading-tight">
              Upload files, chat with AI, build quizzes
            </span>
          </button>

          {/* Workspace Cards */}
          {workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              userId={user.uid}
              onClick={() => router.push(`/workspace/${ws.id}`)}
              onDeleteRequest={() => setDeleteTarget(ws)}
            />
          ))}
        </div>

        {workspaces.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-primary/10 p-6 mb-6">
              <Sparkles className="size-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Create your first workspace
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Workspaces help you organize your documents and conversations.
              Upload files, chat with AI, and generate study materials.
            </p>
            <Button onClick={handleCreateWorkspace} size="lg" className="gap-2">
              <Plus className="size-4" />
              Create Workspace
            </Button>
          </div>
        )}
      </div>

      {/* Delete workspace confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-semibold text-foreground mb-2">
              Delete this workspace?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              This cannot be undone. All files and chats in &ldquo;{deleteTarget.title || "Untitled Workspace"}&rdquo; will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
