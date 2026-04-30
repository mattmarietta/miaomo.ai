"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/Auth";
import {
  subscribeWorkspacesByUserId,
  subscribeWorkspaceFiles,
  subscribeWorkspaceChats,
  createWorkspace,
} from "@/lib/firebase/client-queries";
import {
  DBWorkspaceSchema,
  DBWorkspaceFileSchema,
  DBChatSchema,
} from "@/lib/firebase/schema";
import { Plus, FolderOpen, Clock, FileText, MessageSquare, Sparkles, LayoutGrid } from "lucide-react";
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
}: {
  workspace: DBWorkspaceSchema;
  userId: string;
  onClick: () => void;
}) {
  const [files, setFiles] = useState<DBWorkspaceFileSchema[]>([]);
  const [chats, setChats] = useState<DBChatSchema[]>([]);

  useEffect(() => {
    const unsubFiles = subscribeWorkspaceFiles(workspace.id, userId, setFiles, () => setFiles([]));
    const unsubChats = subscribeWorkspaceChats(workspace.id, userId, setChats, () => setChats([]));
    return () => {
      unsubFiles();
      unsubChats();
    };
  }, [workspace.id, userId]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const recentFileNames = files.slice(0, 3).map((f) => f.originalName);

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer text-left"
    >
      <div className="h-1 w-full bg-primary" />
      <div className="flex flex-col gap-3 px-5 pb-5 pt-3 w-full">
        <div className="rounded-lg bg-primary/10 p-2.5 w-fit">
          <FolderOpen className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0 w-full">
          <h3 className="font-medium text-foreground truncate">
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
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [workspaces, setWorkspaces] = useState<DBWorkspaceSchema[]>([]);

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
          </button>

          {/* Workspace Cards */}
          {workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              userId={user.uid}
              onClick={() => router.push(`/workspace/${ws.id}`)}
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
    </main>
  );
}
