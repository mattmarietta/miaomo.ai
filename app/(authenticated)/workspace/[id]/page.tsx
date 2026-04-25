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

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    // Redirect to a new chat with a generated ID
    const newChatId = crypto.randomUUID();
    router.replace(`/workspace/${id}/chat/${newChatId}`);
  }, [user, loading, router, id]);

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
          externalMessage={externalMessage}
          onExternalMessageSent={handleExternalMessageSent}
          hideExternalMessage={true}
          onFileClick={(file) => {
            router.push(`/workspace/${id}?file=${encodeURIComponent(file.id)}`)
          }}
        />
      </div>

      {/* PDF Viewer — right panel */}
      {selectedFile && selectedFileUrl && (
        <div className="w-[45%] max-w-2xl border-l border-border flex flex-col min-h-0">
          <PdfViewer
            fileUrl={selectedFileUrl}
            fileName={selectedFile.originalName || "Document"}
            fileId={selectedFile.id}
            workspaceId={id}
            userId={user.uid}
            onClose={() => router.push(`/workspace/${id}`)}
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
