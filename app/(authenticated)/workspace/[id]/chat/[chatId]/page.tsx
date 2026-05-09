"use client";

import { useAuth } from "@/components/Auth";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Chat } from "@/components/chat/Chat";
import { ChatAgent } from "@/app/api/chat/ai";
import { subscribeWorkspaceFiles } from "@/lib/firebase/client-queries";
import { DBWorkspaceFileSchema } from "@/lib/firebase/schema";
import { PdfViewer } from "@/components/PdfViewer";
import { MindMap } from "@/components/MindMap";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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
  const [chatMessages, setChatMessages] = useState<ChatAgent[] | null>(null);
  const [citationPage, setCitationPage] = useState<number | undefined>();
  const [citationText, setCitationText] = useState<string | undefined>();
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
        setChatMessages([]);
      }
    };

    loadChatMessages();
  }, [chatId, user]);

  const selectedFile = useMemo(() => {
    if (!selectedFileId) return null;
    return files.find((f) => f.id === selectedFileId) || null;
  }, [selectedFileId, files]);

  const selectedFileUrl = selectedFile?.downloadUrl ?? null;

  // Opening a PDF closes the mind map.
  useEffect(() => {
    if (selectedFile && showMindMap) setShowMindMap(false);
  }, [selectedFile, showMindMap]);

  const toggleMindMap = useCallback(() => {
    const next = !showMindMap;
    if (next && selectedFileId) {
      // Opening mind map closes any selected PDF.
      router.push(`/workspace/${id}/chat/${chatId}`);
    }
    setShowMindMap(next);
  }, [showMindMap, selectedFileId, router, id, chatId]);

  const showRightPanel = (selectedFile && selectedFileUrl) || showMindMap;

  const handleGenerateSummary = () => {
    if (!summaryDialogFile || !summaryDialogFile.fullText) return;

    const summaryMessage = `Please provide a summary of the following document text that was extracted from the document:\n\n${summaryDialogFile.fullText}\n\nPlease summarize the key points from this document.`;
    setExternalMessage(summaryMessage);
    setSummaryDialogFile(null);
  };

  const handleExternalMessageSent = () => {
    setExternalMessage("");
  };

  const handleCitationClick = useCallback((citation: { fileId: string; page?: number; text: string }) => {
    // Navigate to the file in the PDF viewer
    router.push(`/workspace/${id}/chat/${chatId}?file=${encodeURIComponent(citation.fileId)}`);
    setCitationPage(citation.page ?? undefined);
    setCitationText(citation.text?.slice(0, 200));
  }, [id, chatId, router]);

  if (loading || chatMessages === null) {
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
          showRightPanel
            ? "w-[34rem] min-w-[22rem] max-w-[42%] shrink-0 flex flex-col min-h-0 border-r border-border relative"
            : "flex-1 min-w-0 flex flex-col min-h-0 relative"
        }
      >
        <Chat
          key={chatId}
          user={user}
          initialMessages={chatMessages ?? []}
          chatId={chatId}
          workspaceId={id}
          files={files}
          externalMessage={externalMessage}
          onExternalMessageSent={handleExternalMessageSent}
          hideExternalMessage={true}
          onToggleMindMap={toggleMindMap}
          showMindMap={showMindMap}
          onCitationClick={handleCitationClick}
          onFileClick={(file) => {
            setCitationPage(undefined);
            setCitationText(undefined);
            router.push(`/workspace/${id}/chat/${chatId}?file=${encodeURIComponent(file.id)}`)
          }}
        />
      </div>

      {/* Right column: PDF viewer or Mind Map (mutually exclusive) */}
      {selectedFile && selectedFileUrl ? (
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <PdfViewer
            fileUrl={selectedFileUrl}
            fileName={selectedFile.originalName || "Document"}
            fileId={selectedFile.id}
            workspaceId={id}
            userId={user.uid}
            onClose={() => {
              setCitationPage(undefined);
              setCitationText(undefined);
              router.push(`/workspace/${id}/chat/${chatId}`);
            }}
            onSendToChat={(text) => setExternalMessage(text)}
            initialPage={citationPage}
            highlightText={citationText}
          />
        </div>
      ) : showMindMap ? (
        <div className="flex-1 min-w-0 flex flex-col min-h-0 relative">
          <button
            type="button"
            onClick={() => setShowMindMap(false)}
            aria-label="Close mind map"
            className="absolute top-3 right-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/80 backdrop-blur hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <MindMap
            workspaceId={id}
            user={user}
            onLeafClick={(label) => {
              setExternalMessage(`Summarize: ${label}`);
            }}
          />
        </div>
      ) : null}

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