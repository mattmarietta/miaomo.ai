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
import { Plus, FolderOpen, Clock, FileText, MessageSquare } from "lucide-react";

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

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 hover:bg-accent/50 transition-colors cursor-pointer text-left min-h-[160px]"
    >
      <div className="rounded-lg bg-primary/10 p-2.5">
        <FolderOpen className="size-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 w-full">
        <h3 className="font-medium text-foreground truncate">
          {workspace.title || "Untitled Workspace"}
        </h3>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
        </div>

        {/* Workspaces Grid */}
        <div className="mb-6 flex items-center justify-between">
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
          <div className="text-center py-12">
            <FolderOpen className="size-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              No workspaces yet. Create one to get started.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
