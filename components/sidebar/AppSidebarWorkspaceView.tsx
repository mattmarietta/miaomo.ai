"use client";
import { useAuth } from "@/components/Auth";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  subscribeWorkspaceFiles,
  subscribeWorkspaceChats,
} from "@/lib/firebase/client-queries";
import { DBWorkspaceFileSchema, DBChatSchema } from "@/lib/firebase/schema";
import {
  FileText,
  MessageSquare,
  ArrowLeft,
  Plus,
  Paperclip,
  ChevronDown,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/firebase";
import { addWorkspaceFile, updateWorkspaceFileStatus } from "@/lib/firebase/client-queries";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger, 
} from "@/components/ui/collapsible";

interface ConceptScore {
  name: string;
  pct: number;
}

interface FileStats {
  masteryPct: number;
  concepts: ConceptScore[];
}

function masteryBarColor(pct: number): string {
  if (pct >= 70) return "bg-green-500";
  if (pct >= 45) return "bg-amber-400";
  return "bg-red-500";
}

function masteryTextColor(pct: number): string {
  if (pct >= 70) return "text-green-600";
  if (pct >= 45) return "text-amber-500";
  return "text-red-500";
}

const MOCK_STATS: Record<string, FileStats> = {
  "file-1": {
    masteryPct: 82,
    concepts: [
      { name: "Concept 1", pct: 91 },
      { name: "Concept 2", pct: 85 },
      { name: "Concept 3", pct: 74 },
      { name: "Concept 4", pct: 60 },
    ],
  },
  "file-2": {
    masteryPct: 54,
    concepts: [
      { name: "Concept 1", pct: 78 },
      { name: "Concept 2", pct: 55 },
      { name: "Concept 3", pct: 41 },
    ],
  },
  "file-3": {
    masteryPct: 37,
    concepts: [
      { name: "Concept 1", pct: 50 },
      { name: "Concept 2", pct: 40 },
      { name: "Concept 3", pct: 28 },
    ],
  },
}

function getStats(fileId: string, index: number): FileStats | undefined {
  return MOCK_STATS[fileId] ?? MOCK_STATS[`file-${index + 1}`];
}

function getWorkspaceMastery(files: DBWorkspaceFileSchema[]): number | null {
  const quizzed = files
    .map((f, i) => getStats(f.id, i))
    .filter((s): s is FileStats => s !== undefined);
  if (quizzed.length === 0) return null;
  const avg = quizzed.reduce((sum, s) => sum + s.masteryPct, 0) / quizzed.length;
  return Math.round(avg);
}

export const AppSidebarWorkspaceView = ({
  workspaceId,
}: {
  workspaceId: string;
}) => {
  const [files, setFiles] = useState<DBWorkspaceFileSchema[]>([]);
  const [chats, setChats] = useState<DBChatSchema[]>([]);
  const { user } = useAuth();
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // state to track which mastery breakdown is open
  const [openFileId, setOpenFileId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubFiles = subscribeWorkspaceFiles(workspaceId, user.uid, setFiles, () => setFiles([]));
    const unsubChats = subscribeWorkspaceChats(workspaceId, user.uid, setChats, () => setChats([]));
    return () => {
      unsubFiles();
      unsubChats();
    };
  }, [workspaceId, user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const storagePath = `users/${user.uid}/uploads/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      null,
      (err) => {
        console.error(err);
        setUploading(false);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          const fileId = await addWorkspaceFile(workspaceId, {
            originalName: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            storagePath,
            downloadUrl: url,
            ownerUid: user.uid,
          });

          // Check if file type supports OCR
          const ocrSupportedTypes = [
            "application/pdf",
            "image/tiff",
            "image/tif",
            "image/gif",
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/bmp",
            "image/webp",
          ];

          if (ocrSupportedTypes.includes(file.type.toLowerCase())) {
            // Trigger OCR processing
            try {
              await updateWorkspaceFileStatus(workspaceId, fileId, "processing_ocr");
              
              const ocrResponse = await fetch("/api/ocr/url", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  url,
                  mimeType: file.type,
                }),
              });

              if (ocrResponse.ok) {
                const ocrResult = await ocrResponse.json();
                // Store the extracted text and update status
                await updateWorkspaceFileStatus(workspaceId, fileId, "ocr_completed", {
                  fullText: ocrResult.fullText,
                });
              } else {
                const errorData = await ocrResponse.json();
                await updateWorkspaceFileStatus(workspaceId, fileId, "ocr_failed", {
                  errorMessage: errorData.error || "OCR processing failed",
                });
              }
            } catch (ocrError) {
              console.error("OCR processing error:", ocrError);
              await updateWorkspaceFileStatus(workspaceId, fileId, "ocr_failed", {
                errorMessage: ocrError instanceof Error ? ocrError.message : "Unknown OCR error",
              });
            }
          }
        } catch (err) {
          console.error(err);
        } finally {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
    );
  };

  // used to calculate workspace mastery
  const workspaceMastery = getWorkspaceMastery(files);
  const quizzedCount = files.filter((f, i) => getStats(f.id, i)).length;

  return (
    <>
      {/* Back to dashboard */}
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="gap-2 text-muted-foreground">
              <Link href="/dashboard">
                <ArrowLeft className="size-4" />
                <span className="text-sm font-medium">All Workspaces</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      {/* Files */}
      <SidebarGroup>
        <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center justify-between pr-2">
          Files
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-0.5 rounded hover:bg-sidebar-accent transition-colors"
          >
            <Plus className="size-3.5" />
          </button>
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {files.map((file, index) => {
              const isPdf = file.mimeType === "application/pdf";
              const fileUrl = (file as any).downloadUrl;
              // Build URL with file query param so workspace page can show it
              const href =
                isPdf && fileUrl
                  ? `/workspace/${workspaceId}?file=${encodeURIComponent(file.id)}`
                  : `/workspace/${workspaceId}`;
              const stats = getStats(file.id, index);
              const isOpen = openFileId === file.id;

              const getStatusIcon = () => {
                switch (file.status) {
                  case "processing_ocr":
                    return <Loader2 className="size-3.5 shrink-0 text-blue-500 animate-spin ml-2" />;
                  case "ocr_completed":
                    return <CheckCircle className="size-3.5 shrink-0 text-green-500 ml-2" />;
                  case "ocr_failed":
                    return <XCircle className="size-3.5 shrink-0 text-red-500 ml-2" />;
                  default:
                    return null;
                }
              };

              return (
                <SidebarMenuItem key={file.id}>
                  <Collapsible
                    open={isOpen}
                    onOpenChange={(open) =>
                      setOpenFileId(open ? file.id : null)
                    }
                  >
                    <div className="flex items-center gap-1 w-full">
                      <SidebarMenuButton asChild className="flex-1 min-w-0 gap-2" size="sm">
                        <Link href={href}>
                          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm">
                            {file.originalName || "Untitled"}
                          </span>
                        </Link>
                      </SidebarMenuButton>

                      {getStatusIcon()}

                      {stats && (
                        <CollapsibleTrigger className="flex items-center gap-0.5 shrink-0 rounded px-1 py-0.5 hover:bg-sidebar-accent transition-colors">
                          <span className={`text-[10px] font-medium ${masteryTextColor(stats.masteryPct)}`}>
                            {stats.masteryPct}%
                          </span>
                          <ChevronDown
                            className={`size-3 text-muted-foreground/60 transition-transform duration-150 ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </CollapsibleTrigger>
                      )}
                    </div>

                    {stats && (
                      <div className="px-2 pt-0.5 pb-1">
                        <Progress value={stats.masteryPct} className="h-[3px]">
                          <ProgressTrack>
                            <ProgressIndicator className={masteryBarColor(stats.masteryPct)} />
                          </ProgressTrack>
                        </Progress>
                      </div>
                    )}

                    {stats && (
                      <CollapsibleContent>
                        <div className="mx-2 mb-2 rounded-md border border-border/50 bg-muted/40 px-3 py-2 space-y-2">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                            Concept Breakdown
                          </p>
                          {stats.concepts.map((c) => (
                            <div key={c.name} className="space-y-0.5">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                                  {c.name}
                                </span>
                                <span className={`text-[11px] font-medium ${masteryTextColor(c.pct)}`}>
                                  {c.pct}%
                                </span>
                              </div>
                              <Progress value={c.pct} className="h-[3px]">
                                <ProgressTrack>
                                  <ProgressIndicator className={masteryBarColor(c.pct)} />
                                </ProgressTrack>
                              </Progress>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    )}

                    {!stats && (
                      <span className="px-2 pb-1 text-[10px] text-muted-foreground/40 block">
                        not quizzed yet!
                      </span>
                    )}
                  </Collapsible>
                </SidebarMenuItem>
              );
            })}

            {files.length === 0 && !uploading && (
              <SidebarMenuItem>
                <span className="px-2 py-1 text-xs text-muted-foreground/60">
                  No files yet
                </span>
              </SidebarMenuItem>
            )}
            {uploading && (
              <SidebarMenuItem>
                <span className="px-2 py-1 text-xs text-muted-foreground animate-pulse">
                  Uploading...
                </span>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Chats */}
      <SidebarGroup>
        <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Chats
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="gap-2"
                size="sm"
                isActive={pathname === `/workspace/${workspaceId}` && !pathname.includes('/chat/')}
              >
                <Link href={`/workspace/${workspaceId}`}>
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">New Chat</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {chats.map((chat) => (
              <SidebarMenuItem key={chat.id}>
                <SidebarMenuButton
                  asChild
                  className="gap-2"
                  size="sm"
                  isActive={
                    pathname === `/workspace/${workspaceId}/chat/${chat.id}`
                  }
                >
                  <Link href={`/workspace/${workspaceId}/chat/${chat.id}`}>
                    <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">
                      {chat.title || "Untitled chat"}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            {chats.length === 0 && (
              <SidebarMenuItem>
                <span className="px-2 py-1 text-xs text-muted-foreground/60">
                  No chats yet
                </span>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Workspace mastery */}
      {workspaceMastery !== null && (
        <div className="mt-auto p-3 border-t border-border/50">
          <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Workspace Mastery
              </span>
              <span className={`text-sm font-medium ${masteryTextColor(workspaceMastery)}`}>
                {workspaceMastery}%
              </span>
            </div>
            <Progress value={workspaceMastery} className="h-[4px]">
              <ProgressTrack>
                <ProgressIndicator className={masteryBarColor(workspaceMastery)} />
              </ProgressTrack>
            </Progress>
            <p className="text-[10px] text-muted-foreground/50">
              avg. across {quizzedCount} quizzed {quizzedCount === 1 ? "file" : "files"}
            </p>
          </div>
        </div>
      )}
    </>
  );
};
