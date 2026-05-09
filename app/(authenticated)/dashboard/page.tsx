"use client";

import { useEffect, useState, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/Auth";
import {
  subscribeWorkspacesByUserId,
  subscribeWorkspaceFiles,
  subscribeWorkspaceChats,
  createWorkspace,
  deleteWorkspace,
  addWorkspaceFile,
} from "@/lib/firebase/client-queries";
import { getUserQuizzes } from "@/lib/firebase/quizStore";
import { getUserDecks } from "@/lib/firebase/flashcardStore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/firebase";
import {
  DBWorkspaceSchema,
  DBWorkspaceFileSchema,
  DBChatSchema,
} from "@/lib/firebase/schema";
import {
  Plus,
  FolderOpen,
  Clock,
  FileText,
  MessageSquare,
  Upload,
  Trash2,
  CheckCircle2,
  Circle,
} from "lucide-react";

/* ─── Workspace Card ─── */
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div
      onClick={onClick}
      className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 hover:bg-accent/50 transition-colors cursor-pointer text-left min-h-[160px]"
    >
      <div className="flex items-start justify-between w-full">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <FolderOpen className="size-5 text-primary" />
        </div>
        {/* Delete button asks for confirmation before deleting */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Don't open the workspace
            if (confirm("Delete this workspace? This cannot be undone.")) {
              deleteWorkspace(workspace.id, userId);
            }
          }}
          className="p-1.5 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-all"
        >
          <Trash2 className="size-4" />
        </button>
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
    </div>
  );
}

// Checklist items 
const getStartedItems = [
  { id: "workspace", label: "Create a new workspace" },
  { id: "upload", label: "Upload a file to a workspace" },
  { id: "chat", label: "Chat with your files" },
  { id: "quiz", label: "Create a quiz from your notes" },
  { id: "flashcards", label: "Build a flashcard deck" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [workspaces, setWorkspaces] = useState<DBWorkspaceSchema[]>([]);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [hasQuizzes, setHasQuizzes] = useState(false);
  const [hasDecks, setHasDecks] = useState(false);
  const [hasUploads, setHasUploads] = useState(false);
  const [hasChats, setHasChats] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reads localStorage at render time. Returns null on the server so it doesn't flash.
  const onboardingDismissed = useSyncExternalStore<boolean | null>(
    () => () => {},
    () => localStorage.getItem("dashboardOnboardingDone") === "true",
    () => null,
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const unsub = subscribeWorkspacesByUserId(user.uid, setWorkspaces);

    // Check if user has quizzes and flashcard decks
    getUserQuizzes(user.uid).then((q) => setHasQuizzes(q.length > 0));
    getUserDecks(user.uid).then((d) => setHasDecks(d.length > 0));

    return () => unsub();
  }, [loading, user, router]);

  // Check if any workspace has files or chats
  useEffect(() => {
    if (!user || workspaces.length === 0) return;

    const cleanupFunctions: (() => void)[] = [];

    for (let i = 0; i < workspaces.length; i++) {
      const ws = workspaces[i];

      // Subscribe to files for this workspace
      const unsubFiles = subscribeWorkspaceFiles(ws.id, user.uid, function (files) {
        if (files.length > 0) setHasUploads(true);
      }, function () {});

      // Subscribe to chats for this workspace
      const unsubChats = subscribeWorkspaceChats(ws.id, user.uid, function (chats) {
        if (chats.length > 0) setHasChats(true);
      }, function () {});

      cleanupFunctions.push(unsubFiles);
      cleanupFunctions.push(unsubChats);
    }

    return function cleanup() {
      for (let i = 0; i < cleanupFunctions.length; i++) {
        cleanupFunctions[i]();
      }
    };
  }, [user, workspaces]);

  // Autocheck get started steps based on what the user has done
  const allCompletedSteps = [...completedSteps];

  if (workspaces.length > 0 && !allCompletedSteps.includes("workspace")) {
    allCompletedSteps.push("workspace");
  }
  if (hasUploads && !allCompletedSteps.includes("upload")) {
    allCompletedSteps.push("upload");
  }
  if (hasChats && !allCompletedSteps.includes("chat")) {
    allCompletedSteps.push("chat");
  }
  if (hasQuizzes && !allCompletedSteps.includes("quiz")) {
    allCompletedSteps.push("quiz");
  }
  if (hasDecks && !allCompletedSteps.includes("flashcards")) {
    allCompletedSteps.push("flashcards");
  }

  // Once all steps are done, remember it so future refreshes skip the card
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (allCompletedSteps.length >= getStartedItems.length) {
      localStorage.setItem("dashboardOnboardingDone", "true");
    }
  }, [allCompletedSteps.length]);

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

  // When a file is picked, you create a workspace, upload the file, then redirect
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      // Create a new workspace named after the file
      const workspaceId = await createWorkspace(user.uid, file.name);

      // Upload the file to Firebase 
      const storagePath = `users/${user.uid}/uploads/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(fileRef, file);

      // Wait for upload to finish, then save file info to Firestore
      uploadTask.on("state_changed",
        null,
        (err) => console.error("Upload failed:", err),
        async () => {
          // Get download URL after upload is done
          const url = await getDownloadURL(uploadTask.snapshot.ref);

          // Save the file metadata to the workspace
          await addWorkspaceFile(workspaceId, {
            originalName: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            storagePath: storagePath,
            downloadUrl: url,
            ownerUid: user.uid,
          });

          // Go to the new workspace
          router.push(`/workspace/${workspaceId}`);
        }
      );
    } catch (err) {
      console.error("Error uploading file:", err);
    }

    // Reset file input so the same file can be picked again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Toggle a checklist item
  const toggleStep = (id: string) => {
    setCompletedSteps(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  return (
    <main className="flex-1 overflow-y-auto bg-background">
      {/* Hidden file input for the Upload button */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUploadFile}
        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
        className="hidden"
      />

      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Quick actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <Upload className="size-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Upload
              </span>
            </button>
          </div>
        </div>

        {/* Get Started Checklist. Hides once every step is done. */}
        {onboardingDismissed === false && allCompletedSteps.length < getStartedItems.length && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Get started
          </h2>
          <div className="rounded-xl border border-border bg-card p-2">
            {getStartedItems.map((item) => {
              const done = allCompletedSteps.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleStep(item.id)}
                  className="flex items-center gap-3 w-full rounded-lg px-3 py-3 hover:bg-accent/50 transition-colors text-left"
                >
                  {done ? (
                    <CheckCircle2 className="size-5 text-primary flex-shrink-0 transition-colors duration-300" />
                  ) : (
                    <Circle className="size-5 text-muted-foreground flex-shrink-0 transition-colors duration-300" />
                  )}
                  <span className="relative text-sm font-medium transition-colors duration-300">
                    <span className={done ? "text-muted-foreground" : "text-foreground"}>
                      {item.label}
                    </span>
                    <span
                      className={`absolute left-0 top-1/2 h-[1.5px] bg-muted-foreground transition-all duration-500 ease-in-out ${
                        done ? "w-full" : "w-0"
                      }`}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        )}

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
            className="group flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-8 hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer min-h-[160px]"
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
