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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function WorkspaceChatPage() {
  const { id, chatId } = useParams<{ id: string; chatId: string }>();
  const searchParams = useSearchParams();
  const selectedFileId = searchParams.get("file");
  const { user, loading } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<DBWorkspaceFileSchema[]>([]);
  const [previousFiles, setPreviousFiles] = useState<DBWorkspaceFileSchema[]>([]);
  const [summaryDialogFile, setSummaryDialogFile] = useState<DBWorkspaceFileSchema | null>(null);
  const [externalMessage, setExternalMessage] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatAgent[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!id || !user) return;
    const unsub = subscribeWorkspaceFiles(id, user.uid, (newFiles) => {
      // Check for OCR completion
      newFiles.forEach((newFile) => {
        const prevFile = previousFiles.find((f) => f.id === newFile.id);
        if (prevFile && prevFile.status !== "ocr_completed" && newFile.status === "ocr_completed") {
          // OCR just completed for this file
          setSummaryDialogFile(newFile);
        }
      });

      setFiles(newFiles);
      setPreviousFiles(newFiles);
    });
    return () => unsub();
  }, [id, user, previousFiles]);

  // Load chat messages when chatId changes
  useEffect(() => {
    if (!chatId || !user) return;

    const loadChatMessages = async () => {
      try {
        const response = await fetch(`/api/chat/messages/${chatId}`, {
          headers: {
            "Authorization": `Bearer ${await user.getIdToken()}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Convert DB messages to ChatAgent format
          const messages: ChatAgent[] = data.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            parts: msg.parts,
          }));
          setChatMessages(messages);
        }
      } catch (error) {
        console.error("Failed to load chat messages:", error);
      }
    };

    loadChatMessages();
  }, [chatId, user]);

  const selectedFile = useMemo(() => {
    if (!selectedFileId) return null;
    return files.find((f) => f.id === selectedFileId) || null;
  }, [selectedFileId, files]);

  const selectedFileUrl = selectedFile ? (selectedFile as any).downloadUrl : null;

  const handleGenerateSummary = () => {
    if (!summaryDialogFile || !summaryDialogFile.fullText) return;

    const summaryMessage = `Please provide a summary of the following document text that was extracted from the document:\n\n${summaryDialogFile.fullText}\n\nPlease summarize the key points from this document.`;
    setExternalMessage(summaryMessage);
    setSummaryDialogFile(null);
  };

  const handleExternalMessageSent = () => {
    setExternalMessage("");
  };

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
          key={chatId}
          user={user}
          initialMessages={chatMessages}
          chatId={chatId}
          workspaceId={id}
          files={files}
          externalMessage={externalMessage}
          onExternalMessageSent={handleExternalMessageSent}
          hideExternalMessage={true}
          onFileClick={(file) => {
            router.push(`/workspace/${id}/chat/${chatId}?file=${encodeURIComponent(file.id)}`)
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
              href={`/workspace/${id}/chat/${chatId}`}
              className="p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="size-4 text-muted-foreground" />
            </Link>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0">
            {selectedFileUrl ? (
              // Display PDF using iframe
              <iframe
                src={selectedFileUrl}
                className="w-full h-full border-0"
                title={selectedFile.originalName || "Document viewer"}
              />
            ) : (
              // Fallback for when no file is selected
              <div className="p-8 bg-white text-black min-h-full">
                <div className="max-w-4xl mx-auto">
                  <div className="text-muted-foreground text-center py-8">
                    Select a file to view its content
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary Dialog */}
      <Dialog open={!!summaryDialogFile} onOpenChange={() => setSummaryDialogFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Text Processing Complete</DialogTitle>
            <DialogDescription>
              Text processing has finished for "{summaryDialogFile?.originalName}".
              Would you like to generate an initial summary of this document?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSummaryDialogFile(null)}>
              No Thanks
            </Button>
            <Button variant="ghost" onClick={handleGenerateSummary}>
              Yes, Generate Summary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}