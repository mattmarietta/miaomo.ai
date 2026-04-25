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
            {files.map((file) => {
              const isPdf = file.mimeType === "application/pdf";
              const fileUrl = (file as any).downloadUrl;
              // Build URL with file query param so workspace page can show it
              const href =
                isPdf && fileUrl
                  ? pathname.includes("/chat/")
                    ? `${pathname}?file=${encodeURIComponent(file.id)}`
                    : `/workspace/${workspaceId}?file=${encodeURIComponent(file.id)}`
                  : `/workspace/${workspaceId}`;

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
                  <SidebarMenuButton asChild className="gap-2" size="sm">
                    <Link href={href} className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm">
                          {file.originalName || "Untitled"}
                        </span>
                      </div>
                      {getStatusIcon()}
                    </Link>
                  </SidebarMenuButton>
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
    </>
  );
};
