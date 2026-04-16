"use client";

import { useAuth } from "@/components/Auth";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Chat } from "@/components/chat/Chat";
import { ChatAgent } from "@/app/api/chat/ai";
import { subscribeWorkspaceFiles } from "@/lib/firebase/client-queries";
import { DBWorkspaceFileSchema } from "@/lib/firebase/schema";
import { X, FileText, Network } from "lucide-react";
import { MindMap } from "@/components/MindMap";
import Link from "next/link";
import dynamic from "next/dynamic";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), {
  ssr: false,
  loading: () => <div className="p-4 text-muted-foreground">Loading viewer...</div>
});

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const selectedFileId = searchParams.get("file");
  const { user, loading } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<DBWorkspaceFileSchema[]>([]);
  const [showMindMap, setShowMindMap] = useState(false);

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
        <div className="flex items-center justify-end px-3 py-1.5 border-b border-border shrink-0">
          <button
            onClick={() => setShowMindMap((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Network className="size-3.5" />
            Mind Map
          </button>
        </div>
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

          {/* PDF viewer body */}
          <div className="flex-1 min-h-0 bg-background overflow-hidden">
            <PdfViewer url={selectedFileUrl} />
          </div>
        </div>
      )}

      {showMindMap && (
        <div className="w-[45%] max-w-2xl border-l border-border flex flex-col min-h-0 bg-muted/30">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2">
              <Network className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-xs font-medium">Mind Map</span>
            </div>
            <button
              onClick={() => setShowMindMap(false)}
              className="p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <MindMap workspaceId={id} userId={user.uid} />
          </div>
        </div>
      )}
    </div>
  );
}
