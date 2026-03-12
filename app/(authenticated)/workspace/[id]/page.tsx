"use client";

import { useAuth } from "@/components/Auth";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Chat } from "@/components/chat/Chat";
import { ChatAgent } from "@/app/api/chat/ai";
import { subscribeWorkspaceFiles } from "@/lib/firebase/client-queries";
import { DBWorkspaceFileSchema } from "@/lib/firebase/schema";
import { X, FileText } from "lucide-react";
import Link from "next/link";

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const selectedFileId = searchParams.get("file");
  const { user, loading } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<DBWorkspaceFileSchema[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!id || !user) return;
    const unsub = subscribeWorkspaceFiles(id, user.uid, setFiles);
    return () => unsub();
  }, [id, user]);

  const selectedFile = useMemo(() => {
    if (!selectedFileId) return null;
    return files.find((f) => f.id === selectedFileId) || null;
  }, [selectedFileId, files]);

  const selectedFileUrl = selectedFile ? (selectedFile as any).downloadUrl : null;

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-1 min-h-0">
      {/* Chat — center */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <Chat
          key={id}
          user={user}
          initialMessages={[]}
          workspaceId={id}
          files={files}
          onFileClick={(file) => {
            router.push(`/workspace/${id}?file=${encodeURIComponent(file.id)}`)
          }}
        />
      </div>

      {/* PDF Viewer — right panel */}
      {selectedFile && selectedFileUrl && (
        <div className="w-[45%] max-w-2xl border-l border-border flex flex-col min-h-0 bg-muted/30">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-xs font-medium truncate">
                {selectedFile.originalName || "Document"}
              </span>
            </div>
            <Link
              href={`/workspace/${id}`}
              className="p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="size-4 text-muted-foreground" />
            </Link>
          </div>

          {/* PDF iframe */}
          <div className="flex-1 min-h-0">
            <iframe
              src={selectedFileUrl}
              className="w-full h-full border-0"
              title={selectedFile.originalName || "Document viewer"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
