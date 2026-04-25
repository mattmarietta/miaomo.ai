"use client";

import { useAuth } from "@/components/Auth";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Chat } from "@/components/chat/Chat";
import { ChatAgent } from "@/app/api/chat/ai";
import { subscribeWorkspaceFiles } from "@/lib/firebase/client-queries";
import { DBWorkspaceFileSchema } from "@/lib/firebase/schema";
import { PdfViewer } from "@/components/PdfViewer";
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
          const data = (await response.json()) as { messages: ChatAgent[] };
          // Convert DB messages to ChatAgent format
          const messages: ChatAgent[] = data.messages.map((msg) => ({
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

  const selectedFileUrl = selectedFile?.downloadUrl ?? null;

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
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Chat — left */}
      <div
        className={
          selectedFile && selectedFileUrl
            ? "w-[34rem] min-w-[22rem] max-w-[42%] shrink-0 flex flex-col min-h-0 border-r border-border"
            : "flex-1 min-w-0 flex flex-col min-h-0"
        }
      >
        <Chat
          key={chatId}
          user={user}
          initialMessages={chatMessages}
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

      {/* PDF Viewer — centered PDF with tools on the right */}
      {selectedFile && selectedFileUrl && (
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <PdfViewer
            fileUrl={selectedFileUrl}
            fileName={selectedFile.originalName || "Document"}
            fileId={selectedFile.id}
            workspaceId={id}
            userId={user.uid}
            onClose={() => router.push(`/workspace/${id}/chat/${chatId}`)}
            onSendToChat={(text) => setExternalMessage(text)}
          />
        </div>
      )}

      {/* Summary Dialog */}
      <Dialog open={!!summaryDialogFile} onOpenChange={() => setSummaryDialogFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Text Processing Complete</DialogTitle>
            <DialogDescription>
              Text processing has finished for &quot;{summaryDialogFile?.originalName}&quot;.
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