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
  deleteWorkspaceFile,
} from "@/lib/firebase/client-queries";
import { DBWorkspaceFileSchema, DBChatSchema } from "@/lib/firebase/schema";
import {
  FileText,
  MessageSquare,
  ArrowLeft,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/firebase";
import { addWorkspaceFile, generateWorkspaceFileId, updateWorkspaceFileStatus } from "@/lib/firebase/client-queries";

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
  const [fileToDelete, setFileToDelete] = useState<DBWorkspaceFileSchema | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);

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
    const fileId = generateWorkspaceFileId(workspaceId);
    const storagePath = `workspaces/${workspaceId}/files/${fileId}/${file.name}`;
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
          await addWorkspaceFile(workspaceId, {
            originalName: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            storagePath,
            downloadUrl: url,
            ownerUid: user.uid,
          }, fileId);

          const isPdf = file.type.toLowerCase() === "application/pdf";
          const ocrSupportedTypes = [
            "image/tiff",
            "image/tif",
            "image/gif",
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/bmp",
            "image/webp",
          ];

          if (isPdf) {
            // PDFs: skip OCR, go straight to vectorization
            try {
              await updateWorkspaceFileStatus(workspaceId, fileId, "indexing");
              const token = await user.getIdToken();
              const ingestRes = await fetch(`/api/documents/${fileId}/ingest`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                  url,
                  workspaceId,
                  source: file.name,
                }),
              });
              if (ingestRes.ok) {
                const ingestResult = await ingestRes.json();
                await updateWorkspaceFileStatus(workspaceId, fileId, "done", {
                  fullText: ingestResult.fullText,
                  vectorCount: ingestResult.inserted,
                });
              } else {
                const errorData = await ingestRes.json();
                console.error("Vectorization failed:", errorData.error);
                await updateWorkspaceFileStatus(workspaceId, fileId, "indexing_failed", {
                  errorMessage: errorData.error || "Vectorization failed",
                });
              }
            } catch (ingestError) {
              console.error("Vectorization error:", ingestError);
              await updateWorkspaceFileStatus(workspaceId, fileId, "indexing_failed", {
                errorMessage: ingestError instanceof Error ? ingestError.message : "Unknown error",
              });
            }
          } else if (ocrSupportedTypes.includes(file.type.toLowerCase())) {
            // Images: OCR first, then vectorize
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

  const handleConfirmFileDelete = async () => {
    if (!fileToDelete) return;
    setDeletingFile(true);
    try {
      await deleteWorkspaceFile(workspaceId, fileToDelete.id, fileToDelete.storagePath);
    } catch (err) {
      console.error("Failed to delete file:", err);
    } finally {
      setDeletingFile(false);
      setFileToDelete(null);
    }
  };

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
              const href =
                isPdf && fileUrl
                  ? pathname.includes("/chat/")
                    ? `${pathname}?file=${encodeURIComponent(file.id)}`
                    : `/workspace/${workspaceId}?file=${encodeURIComponent(file.id)}`
                  : `/workspace/${workspaceId}`;

              const getStatusIcon = () => {
                switch (file.status) {
                  case "processing_ocr":
                  case "indexing":
                    return <Loader2 className="size-3.5 shrink-0 text-blue-500 animate-spin" />;
                  case "ocr_completed":
                  case "done":
                    return <CheckCircle className="size-3.5 shrink-0 text-green-500" />;
                  case "ocr_failed":
                  case "indexing_failed":
                    return <XCircle className="size-3.5 shrink-0 text-red-500" />;
                  default:
                    return null;
                }
              };

              return (
                <SidebarMenuItem key={file.id} className="group/file">
                  <div className="relative flex items-center w-full">
                    <SidebarMenuButton asChild className="gap-2 flex-1 pr-7" size="sm">
                      <Link href={href}>
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm">
                          {file.originalName || "Untitled"}
                        </span>
                        <span className="ml-auto shrink-0">{getStatusIcon()}</span>
                      </Link>
                    </SidebarMenuButton>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFileToDelete(file);
                      }}
                      className="absolute right-1 opacity-0 group-hover/file:opacity-100 transition-opacity p-1 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-red-500"
                      aria-label={`Delete ${file.originalName}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
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

      {/* File delete confirmation modal */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-semibold text-foreground mb-2">
              Delete this file?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              This cannot be undone. &ldquo;{fileToDelete.originalName}&rdquo; and all its indexed data will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setFileToDelete(null)}
                disabled={deletingFile}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFileDelete}
                disabled={deletingFile}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deletingFile ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics link */}
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="gap-2"
              size="sm"
              isActive={pathname === `/workspace/${workspaceId}/stats`}
            >
              <Link href={`/workspace/${workspaceId}/stats`}>
                <BarChart3 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">Statistics</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
    </>
  );
};
