"use client";

import { useEffect, useState } from "react";
import { subscribeWorkspaceFiles, subscribeWorkspacesByUserId } from "@/lib/firebase/client-queries";
import { DBWorkspaceFileSchema, DBWorkspaceSchema } from "@/lib/firebase/schema";
import {
  Plus,
  FileText,
  Sparkles,
  Upload,
  ClipboardPaste,
  X,
  FolderOpen,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

const MIN_CHARS = 300;
const MAX_CHARS = 100000;

type Mode = "select" | "paste" | "upload" | "empty" | "workspace";

export type GenerateQuizInput = {
  title: string;
  description: string;
  text: string;
  count: number;
  types: string[];
  source?: { workspaceId: string; fileIds: string[] };
};

interface QuizCreateModalProps {
  userId: string;
  onClose: () => void;
  onCreateEmpty: (title: string, description: string) => Promise<void>;
  onGenerate: (input: GenerateQuizInput) => Promise<void>;
}

export function QuizCreateModal({
  userId,
  onClose,
  onCreateEmpty,
  onGenerate,
}: QuizCreateModalProps) {
  const [mode, setMode] = useState<Mode>("select");

  // Modal owns its workspace list now so the parent page doesn't need to import client-queries.
  const [workspaces, setWorkspaces] = useState<DBWorkspaceSchema[]>([]);
  useEffect(() => {
    const unsub = subscribeWorkspacesByUserId(userId, setWorkspaces);
    return () => unsub();
  }, [userId]);

  // Empty mode
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Shared text input across paste and upload modes
  const [pasteText, setPasteText] = useState("");
  const [questionCount, setQuestionCount] = useState(10);

  // Question types
  const [includeMultipleChoice, setIncludeMultipleChoice] = useState(true);
  const [includeTrueFalse, setIncludeTrueFalse] = useState(true);
  const [includeWritten, setIncludeWritten] = useState(true);
  const [includeMatching, setIncludeMatching] = useState(false);

  // Upload mode
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractMethod, setExtractMethod] = useState<string | null>(null);

  // Workspace RAG mode
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<DBWorkspaceFileSchema[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [ragQuery, setRagQuery] = useState("");
  const [ragRetrieving, setRagRetrieving] = useState(false);
  const [ragChunks, setRagChunks] = useState<{ text: string; source: string; fileId: string }[]>([]);
  const [ragError, setRagError] = useState("");

  // Subscribe to files of the selected workspace (only while in workspace mode)
  useEffect(() => {
    if (!selectedWorkspaceId) {
      setWorkspaceFiles([]);
      return;
    }
    const unsub = subscribeWorkspaceFiles(selectedWorkspaceId, userId, setWorkspaceFiles);
    return () => unsub();
  }, [selectedWorkspaceId, userId]);

  const charCount = pasteText.length;
  const isValidLength = charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const indexedFiles = workspaceFiles.filter(
    (f) => f.status === "done" && (f.vectorCount ?? 0) > 0
  );

  function getSelectedTypes(): string[] {
    const types: string[] = [];
    if (includeMultipleChoice) types.push("multiple-choice");
    if (includeTrueFalse) types.push("true-false");
    if (includeWritten) types.push("written");
    if (includeMatching) types.push("matching");
    return types;
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    setExtractError(null);
    setUploadedFileName(file.name);
    setExtractMethod(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract/text", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setPasteText(data.text);
      setExtractMethod(data.method);
    } catch (err) {
      console.error(err);
      setExtractError(err instanceof Error ? err.message : "Failed to read file");
      setUploadedFileName(null);
    } finally {
      setExtracting(false);
      e.target.value = "";
    }
  }

  async function handleRagRetrieve() {
    if (!selectedWorkspaceId || !ragQuery.trim()) return;
    setRagRetrieving(true);
    setRagError("");
    setRagChunks([]);

    try {
      const fileIds = Array.from(selectedFileIds);
      const requests = fileIds.length > 0
        ? fileIds.map((fid) =>
            fetch("/api/rag/retrieve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ workspaceId: selectedWorkspaceId, query: ragQuery, topK: 5, fileId: fid }),
            }).then((r) => r.json())
          )
        : [
            fetch("/api/rag/retrieve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ workspaceId: selectedWorkspaceId, query: ragQuery, topK: 10 }),
            }).then((r) => r.json()),
          ];

      const results = await Promise.all(requests);
      const allChunks = results.flatMap((r) =>
        (r.matches ?? []).map((m: { text: string; source: string; fileId: string }) => ({
          text: m.text,
          source: m.source,
          fileId: m.fileId,
        }))
      );
      setRagChunks(allChunks);
    } catch (err) {
      console.error(err);
      setRagError("Failed to retrieve content. Check that Pinecone is configured.");
    } finally {
      setRagRetrieving(false);
    }
  }

  function deriveTitleFromText(text: string): string {
    const firstLine = text.split("\n")[0] || text;
    return firstLine.substring(0, 50).trim() + (firstLine.length > 50 ? "..." : "");
  }

  async function submitEmpty() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await onCreateEmpty(newTitle.trim(), newDesc.trim());
    } finally {
      setCreating(false);
    }
  }

  async function submitFromText() {
    if (!isValidLength) return;
    const types = getSelectedTypes();
    if (types.length === 0) {
      alert("Please select at least one question type");
      return;
    }
    await onGenerate({
      title: deriveTitleFromText(pasteText),
      description: "Generated from pasted text",
      text: pasteText,
      count: questionCount,
      types,
    });
  }

  async function submitFromRag() {
    if (ragChunks.length === 0) return;
    const types = getSelectedTypes();
    if (types.length === 0) {
      alert("Please select at least one question type");
      return;
    }
    const combinedText = ragChunks.map((c) => c.text).join("\n\n");
    const title = ragQuery.substring(0, 50).trim() + (ragQuery.length > 50 ? "..." : "");
    await onGenerate({
      title,
      description: `Generated from workspace files: ${ragQuery}`,
      text: combinedText,
      count: questionCount,
      types,
      source: {
        workspaceId: selectedWorkspaceId!,
        fileIds: Array.from(selectedFileIds),
      },
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {mode === "select" && "Create Quiz"}
            {mode === "paste" && "Paste Text"}
            {mode === "upload" && "Upload File"}
            {mode === "empty" && "New Quiz"}
            {mode === "workspace" && "From Workspace Files"}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X size={20} />
          </button>
        </div>

        {mode === "select" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("paste")}
              className="w-full flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-muted text-left"
            >
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <ClipboardPaste size={20} className="text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Paste Text</p>
                <p className="text-sm text-muted-foreground">Generate questions from your notes</p>
              </div>
            </button>

            <button
              onClick={() => setMode("workspace")}
              className="w-full flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-muted text-left"
            >
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <FolderOpen size={20} className="text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">From Workspace Files</p>
                <p className="text-sm text-muted-foreground">Generate from your indexed documents</p>
              </div>
            </button>

            <button
              onClick={() => setMode("upload")}
              className="w-full flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-muted text-left"
            >
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Upload size={20} className="text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Upload File</p>
                <p className="text-sm text-muted-foreground">PDF or image, extracted via OCR</p>
              </div>
            </button>

            <button
              onClick={() => setMode("empty")}
              className="w-full flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-muted text-left"
            >
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Plus size={20} className="text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Create Empty</p>
                <p className="text-sm text-muted-foreground">Add questions manually</p>
              </div>
            </button>
          </div>
        )}

        {mode === "paste" && (
          <div>
            <button onClick={() => setMode("select")} className="text-sm text-muted-foreground hover:text-foreground mb-4">
              ← Back
            </button>

            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your notes here (min 300 characters)..."
              className="w-full h-40 bg-background border border-border rounded-lg px-4 py-3 text-sm resize-none mb-3"
            />

            <div className="flex justify-between items-center mb-4">
              <span className="text-xs text-muted-foreground">{charCount} characters</span>
              {charCount > 0 && !isValidLength && (
                <span className="text-xs text-red-500">Min 300, max 100,000</span>
              )}
            </div>

            {isValidLength && (
              <TypeAndCountConfig
                includeMultipleChoice={includeMultipleChoice} setIncludeMultipleChoice={setIncludeMultipleChoice}
                includeTrueFalse={includeTrueFalse} setIncludeTrueFalse={setIncludeTrueFalse}
                includeWritten={includeWritten} setIncludeWritten={setIncludeWritten}
                includeMatching={includeMatching} setIncludeMatching={setIncludeMatching}
                questionCount={questionCount} setQuestionCount={setQuestionCount}
              />
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={submitFromText}
                disabled={!isValidLength}
                className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                Generate
              </button>
            </div>
          </div>
        )}

        {mode === "upload" && (
          <div>
            <button
              onClick={() => { setMode("select"); setPasteText(""); setUploadedFileName(null); setExtractError(null); setExtractMethod(null); }}
              className="text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              ← Back
            </button>

            {!uploadedFileName && !extracting && (
              <label className="block w-full border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-muted/30">
                <Upload size={28} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">Click to upload</p>
                <p className="text-xs text-muted-foreground">PDF, PNG, or JPG (max 20MB)</p>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
              </label>
            )}

            {extracting && (
              <div className="p-6 text-center border border-border rounded-xl">
                <p className="text-sm font-medium mb-1">Reading your file...</p>
                <p className="text-xs text-muted-foreground">Scanned PDFs take a bit longer (OCR).</p>
              </div>
            )}

            {extractError && (
              <div className="p-4 border border-red-500/30 bg-red-500/10 rounded-xl mb-4">
                <p className="text-sm text-red-500">{extractError}</p>
              </div>
            )}

            {uploadedFileName && !extracting && (
              <>
                <div className="p-4 border border-border rounded-xl mb-4 flex items-start gap-3">
                  <FileText size={20} className="text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{uploadedFileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {charCount.toLocaleString()} characters
                      {extractMethod === "pdf-ocr" && " (OCR)"}
                      {extractMethod === "image-ocr" && " (OCR)"}
                    </p>
                  </div>
                </div>

                {charCount > 0 && !isValidLength && (
                  <p className="text-xs text-red-500 mb-3">
                    Need between {MIN_CHARS} and {MAX_CHARS.toLocaleString()} characters; got {charCount.toLocaleString()}.
                  </p>
                )}

                {isValidLength && (
                  <TypeAndCountConfig
                    includeMultipleChoice={includeMultipleChoice} setIncludeMultipleChoice={setIncludeMultipleChoice}
                    includeTrueFalse={includeTrueFalse} setIncludeTrueFalse={setIncludeTrueFalse}
                    includeWritten={includeWritten} setIncludeWritten={setIncludeWritten}
                    includeMatching={includeMatching} setIncludeMatching={setIncludeMatching}
                    questionCount={questionCount} setQuestionCount={setQuestionCount}
                  />
                )}
              </>
            )}

            <div className="flex gap-3 mt-4">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={submitFromText}
                disabled={!isValidLength || extracting}
                className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                Generate
              </button>
            </div>
          </div>
        )}

        {mode === "empty" && (
          <div>
            <button onClick={() => setMode("select")} className="text-sm text-muted-foreground hover:text-foreground mb-4">
              ← Back
            </button>

            <input
              type="text"
              placeholder="Quiz title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 mb-3 text-sm"
              autoFocus
            />
            <textarea
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 mb-4 resize-none text-sm"
              rows={3}
            />

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={submitEmpty}
                disabled={!newTitle.trim() || creating}
                className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        )}

        {mode === "workspace" && (
          <div>
            <button onClick={() => setMode("select")} className="text-sm text-muted-foreground hover:text-foreground mb-4">
              ← Back
            </button>

            <label className="text-sm font-medium mb-2 block">Workspace</label>
            <select
              value={selectedWorkspaceId ?? ""}
              onChange={(e) => {
                setSelectedWorkspaceId(e.target.value || null);
                setSelectedFileIds(new Set());
                setRagChunks([]);
                setRagError("");
              }}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm mb-4"
            >
              <option value="">Select a workspace...</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.title}</option>
              ))}
            </select>

            {selectedWorkspaceId && (
              <>
                <label className="text-sm font-medium mb-2 block">
                  Indexed Files
                  {indexedFiles.length === 0 && workspaceFiles.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (no files indexed yet — upload and wait for processing)
                    </span>
                  )}
                </label>

                {indexedFiles.length > 0 ? (
                  <div className="space-y-1 mb-4 max-h-40 overflow-y-auto">
                    {indexedFiles.map((file) => (
                      <label key={file.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedFileIds.has(file.id)}
                          onChange={(e) => {
                            setSelectedFileIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(file.id);
                              else next.delete(file.id);
                              return next;
                            });
                          }}
                          className="rounded"
                        />
                        <FileText size={14} className="text-muted-foreground shrink-0" />
                        <span className="truncate flex-1">{file.originalName}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{file.vectorCount ?? 0} vectors</span>
                      </label>
                    ))}
                    <p className="text-xs text-muted-foreground px-2 pt-1">Leave unchecked to search all files</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg mb-4 text-sm text-muted-foreground">
                    <AlertCircle size={14} />
                    {workspaceFiles.length === 0
                      ? "No files in this workspace. Upload PDFs first."
                      : "Files are still processing. Wait for indexing to complete."}
                  </div>
                )}

                <label className="text-sm font-medium mb-2 block">Topic / Query</label>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                    placeholder="e.g. Photosynthesis, Chapter 3 concepts..."
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleRagRetrieve();
                      }
                    }}
                  />
                  <button
                    onClick={handleRagRetrieve}
                    disabled={!ragQuery.trim() || ragRetrieving || indexedFiles.length === 0}
                    className="px-4 py-2.5 bg-foreground text-background rounded-lg text-sm disabled:opacity-50 flex items-center gap-2 shrink-0"
                  >
                    {ragRetrieving ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    Retrieve
                  </button>
                </div>

                {ragError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg mb-4 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle size={14} />
                    {ragError}
                  </div>
                )}

                {ragChunks.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 size={14} className="text-green-600" />
                      <span className="text-sm font-medium">Retrieved {ragChunks.length} relevant passages</span>
                    </div>

                    <div className="max-h-32 overflow-y-auto bg-muted/30 rounded-lg p-3 mb-4 space-y-2">
                      {ragChunks.slice(0, 3).map((chunk, i) => (
                        <p key={i} className="text-xs text-muted-foreground line-clamp-2">{chunk.text}</p>
                      ))}
                      {ragChunks.length > 3 && (
                        <p className="text-xs text-muted-foreground/60">+{ragChunks.length - 3} more passages</p>
                      )}
                    </div>

                    <TypeAndCountConfig
                      includeMultipleChoice={includeMultipleChoice} setIncludeMultipleChoice={setIncludeMultipleChoice}
                      includeTrueFalse={includeTrueFalse} setIncludeTrueFalse={setIncludeTrueFalse}
                      includeWritten={includeWritten} setIncludeWritten={setIncludeWritten}
                      includeMatching={includeMatching} setIncludeMatching={setIncludeMatching}
                      questionCount={questionCount} setQuestionCount={setQuestionCount}
                    />

                    <div className="flex gap-3">
                      <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">
                        Cancel
                      </button>
                      <button
                        onClick={submitFromRag}
                        className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm flex items-center justify-center gap-2"
                      >
                        <Sparkles size={16} />
                        Generate Quiz
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Small helper to keep the question-types/count UI from being copy-pasted three times.
function TypeAndCountConfig({
  includeMultipleChoice, setIncludeMultipleChoice,
  includeTrueFalse, setIncludeTrueFalse,
  includeWritten, setIncludeWritten,
  includeMatching, setIncludeMatching,
  questionCount, setQuestionCount,
}: {
  includeMultipleChoice: boolean; setIncludeMultipleChoice: (v: boolean) => void;
  includeTrueFalse: boolean; setIncludeTrueFalse: (v: boolean) => void;
  includeWritten: boolean; setIncludeWritten: (v: boolean) => void;
  includeMatching: boolean; setIncludeMatching: (v: boolean) => void;
  questionCount: number; setQuestionCount: (v: number) => void;
}) {
  return (
    <div className="mb-4 p-4 bg-muted/50 rounded-lg">
      <p className="text-sm font-medium mb-3">Question Types</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeMultipleChoice} onChange={(e) => setIncludeMultipleChoice(e.target.checked)} />
          Multiple Choice
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeTrueFalse} onChange={(e) => setIncludeTrueFalse(e.target.checked)} />
          True / False
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeWritten} onChange={(e) => setIncludeWritten(e.target.checked)} />
          Written
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeMatching} onChange={(e) => setIncludeMatching(e.target.checked)} />
          Matching
        </label>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <span className="text-sm">Questions:</span>
        <select
          value={questionCount}
          onChange={(e) => setQuestionCount(Number(e.target.value))}
          className="bg-background border border-border rounded px-2 py-1 text-sm"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
          <option value={20}>20</option>
        </select>
      </div>
    </div>
  );
}
