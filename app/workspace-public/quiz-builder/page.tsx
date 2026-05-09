"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/Auth";
import { Quiz, getUserQuizzes, createQuiz, deleteQuiz, updateQuiz } from "@/lib/firebase/quizStore";
import { Flashcard, getUserDecks, createDeck, deleteDeck, updateDeck, createNewCard } from "@/lib/firebase/flashcardStore";
import { generateQuestionsFromText } from "@/lib/aiQuizGenerator";
import { generateFlashcardsFromText } from "@/lib/aiFlashcardGenerator";
import { ArrowLeft, Plus, FileText, Trash2, Play, Layers, Upload, ClipboardPaste, X } from "lucide-react";

type Tab = "quizzes" | "flashcards";
type QuizCreateMode = "select" | "paste" | "upload" | "empty";
type DeckCreateMode = "select" | "paste" | "upload" | "empty";

const MIN_CHARS = 300;
const MAX_CHARS = 100000;

export default function StudyToolsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Quiz state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Flashcard state
  const [decks, setDecks] = useState<Flashcard[]>([]);
  
  // Tab navigation
  const [activeTab, setActiveTab] = useState<Tab>("quizzes");
  
  // Quiz create modal
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizCreateMode, setQuizCreateMode] = useState<QuizCreateMode>("select");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Paste text state
  const [pasteText, setPasteText] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState("");
  
  // Question type toggles
  const [includeMultipleChoice, setIncludeMultipleChoice] = useState(true);
  const [includeTrueFalse, setIncludeTrueFalse] = useState(true);
  const [includeWritten, setIncludeWritten] = useState(true);
  const [includeMatching, setIncludeMatching] = useState(false);

  // Flashcard create modal
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [deckCreateMode, setDeckCreateMode] = useState<DeckCreateMode>("select");
  const [deckTitle, setDeckTitle] = useState("");
  const [deckDesc, setDeckDesc] = useState("");
  const [deckPasteText, setDeckPasteText] = useState("");
  const [deckCardCount, setDeckCardCount] = useState(10);

  // File upload state — shared between quiz + deck upload flows, since only
  // one modal is open at a time.
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractMethod, setExtractMethod] = useState<string | null>(null);

  const charCount = pasteText.length;
  const isValidLength = charCount >= MIN_CHARS && charCount <= MAX_CHARS;

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    async function load() {
      if (!user) return;
      try {
        const quizData = await getUserQuizzes(user.uid);
        setQuizzes(quizData);
        
        const deckData = await getUserDecks(user.uid);
        setDecks(deckData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [user]);

  // Create empty quiz
  async function handleCreateEmptyQuiz() {
    if (!user || !newTitle.trim()) return;
    setCreating(true);
    try {
      const quiz = await createQuiz(user.uid, newTitle.trim(), newDesc.trim());
      router.push(`/workspace-public/quiz-builder/${quiz.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create quiz");
      setCreating(false);
    }
  }

  // Generate quiz from pasted text
  async function handleGenerateQuiz() {
    if (!user || !isValidLength) return;
    
    const types: string[] = [];
    if (includeMultipleChoice) types.push("multiple-choice");
    if (includeTrueFalse) types.push("true-false");
    if (includeWritten) types.push("written");
    if (includeMatching) types.push("matching");
    
    if (types.length === 0) {
      alert("Please select at least one question type");
      return;
    }

    setGenerating(true);
    setGeneratingStatus("Creating quiz...");
    setShowQuizModal(false);

    try {
      const firstLine = pasteText.split('\n')[0] || pasteText;
      const title = firstLine.substring(0, 50).trim() + (firstLine.length > 50 ? "..." : "");
      
      const quiz = await createQuiz(user.uid, title, "Generated from pasted text");
      
      setGeneratingStatus("Generating questions...");
      const questions = await generateQuestionsFromText(pasteText, questionCount, types);
      
      setGeneratingStatus("Saving...");
      await updateQuiz(quiz.id, { questions });
      
      router.push(`/workspace-public/quiz-builder/${quiz.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to generate. Please try again.");
      setGenerating(false);
      setGeneratingStatus("");
    }
  }

  // Create flashcard deck (empty — no AI involved)
  async function handleCreateDeck() {
    if (!user || !deckTitle.trim()) return;
    setCreating(true);
    try {
      const deck = await createDeck(user.uid, deckTitle.trim(), deckDesc.trim());
      router.push(`/workspace-public/quiz-builder/flashcards/${deck.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create deck");
      setCreating(false);
    }
  }

  // Generate flashcards from pasted text
  async function handleGenerateDeck() {
    if (!user || !deckPasteText || deckPasteText.length < MIN_CHARS) return;

    setGenerating(true);
    setGeneratingStatus("Creating deck...");
    setShowDeckModal(false);

    try {
      // Prefer the uploaded filename for the title if we have one, otherwise
      // fall back to the first line of the text.
      const title = uploadedFileName
        ? uploadedFileName.replace(/\.[^.]+$/, "").substring(0, 50)
        : (deckPasteText.split('\n')[0] || deckPasteText).substring(0, 50).trim();

      const deck = await createDeck(user.uid, title, "Generated from text");

      setGeneratingStatus("Generating cards...");
      const aiCards = await generateFlashcardsFromText(deckPasteText, deckCardCount);
      const cards = aiCards.map(c => createNewCard(c.front, c.back));

      setGeneratingStatus("Saving...");
      await updateDeck(deck.id, { cards });

      router.push(`/workspace-public/quiz-builder/flashcards/${deck.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to generate deck. Please try again.");
      setGenerating(false);
      setGeneratingStatus("");
    }
  }

  // Shared file-upload handler. Sends the file to our extraction endpoint,
  // then stuffs the extracted text into whichever textarea we're targeting
  // (quiz paste textarea or deck paste textarea).
  async function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    target: "quiz" | "deck"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setExtractError(null);
    setUploadedFileName(file.name);
    setExtractMethod(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract/text", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Extraction failed");

      // Drop the extracted text into the right state bucket.
      if (target === "quiz") {
        setPasteText(data.text);
      } else {
        setDeckPasteText(data.text);
      }
      setExtractMethod(data.method);
    } catch (err) {
      console.error(err);
      setExtractError(err instanceof Error ? err.message : "Failed to read file");
      setUploadedFileName(null);
    } finally {
      setExtracting(false);
      // reset the input so the same file can be picked again if the user wants
      e.target.value = "";
    }
  }

  async function handleDeleteQuiz(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this quiz?")) return;
    try {
      await deleteQuiz(id);
      setQuizzes(quizzes.filter(q => q.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteDeck(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this deck?")) return;
    try {
      await deleteDeck(id);
      setDecks(decks.filter(d => d.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  // Wipe any leftover upload state. Used by both modals when they open/close.
  function resetUploadState() {
    setUploadedFileName(null);
    setExtracting(false);
    setExtractError(null);
    setExtractMethod(null);
  }

  function openQuizModal() {
    setQuizCreateMode("select");
    setNewTitle("");
    setNewDesc("");
    setPasteText("");
    resetUploadState();
    setShowQuizModal(true);
  }

  function closeQuizModal() {
    setShowQuizModal(false);
    setQuizCreateMode("select");
    setNewTitle("");
    setNewDesc("");
    setPasteText("");
    resetUploadState();
  }

  function openDeckModal() {
    setDeckCreateMode("select");
    setDeckTitle("");
    setDeckDesc("");
    setDeckPasteText("");
    setDeckCardCount(10);
    resetUploadState();
    setShowDeckModal(true);
  }

  function closeDeckModal() {
    setShowDeckModal(false);
    setDeckCreateMode("select");
    setDeckTitle("");
    setDeckDesc("");
    setDeckPasteText("");
    resetUploadState();
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  // Generating screen
  if (generating) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-6 animate-pulse">
          <FileText size={28} className="text-muted-foreground" />
        </div>
        <h2 className="text-xl font-medium text-foreground mb-2">{generatingStatus}</h2>
        <p className="text-sm text-muted-foreground">This may take a moment</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.push("/workspace-public")} className="p-2 hover:bg-muted rounded-lg">
            <ArrowLeft size={20} className="text-muted-foreground" />
          </button>
          <div>
            <h1 className="font-semibold">Study Tools</h1>
            <p className="text-xs text-muted-foreground">Tests and flashcards</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit mb-8">
          <button
            onClick={() => setActiveTab("quizzes")}
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${
              activeTab === "quizzes" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            <FileText size={14} />
            Tests
          </button>
          <button
            onClick={() => setActiveTab("flashcards")}
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${
              activeTab === "flashcards" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Layers size={14} />
            Flashcards
          </button>
        </div>

        {/* Quizzes Tab */}
        {activeTab === "quizzes" && (
          <div>
            <button
              onClick={openQuizModal}
              className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-muted-foreground hover:text-foreground mb-6"
            >
              <Plus size={20} />
              <span className="font-medium">Create Test</span>
            </button>

            {quizzes.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <FileText size={40} className="text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No tests yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {quizzes.map(quiz => (
                  <div
                    key={quiz.id}
                    onClick={() => router.push(`/workspace-public/quiz-builder/${quiz.id}`)}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-xl cursor-pointer hover:bg-muted/50 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        <FileText size={20} className="text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium">{quiz.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {quiz.questions.length} {quiz.questions.length === 1 ? "question" : "questions"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                      {quiz.questions.length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/workspace-public/quiz-builder/${quiz.id}/take`); }}
                          className="p-2 hover:bg-muted rounded-lg"
                        >
                          <Play size={18} className="text-muted-foreground" />
                        </button>
                      )}
                      <button onClick={(e) => handleDeleteQuiz(quiz.id, e)} className="p-2 hover:bg-muted rounded-lg">
                        <Trash2 size={18} className="text-muted-foreground hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Flashcards Tab */}
        {activeTab === "flashcards" && (
          <div>
            <button
              onClick={openDeckModal}
              className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-muted-foreground hover:text-foreground mb-6"
            >
              <Plus size={20} />
              <span className="font-medium">Create Deck</span>
            </button>

            {decks.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <Layers size={40} className="text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No flashcard decks yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {decks.map(deck => (
                  <div
                    key={deck.id}
                    onClick={() => router.push(`/workspace-public/quiz-builder/flashcards/${deck.id}`)}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-xl cursor-pointer hover:bg-muted/50 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        <Layers size={20} className="text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium">{deck.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {deck.cards.length} {deck.cards.length === 1 ? "card" : "cards"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                      {deck.cards.length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/workspace-public/quiz-builder/flashcards/${deck.id}/study`); }}
                          className="p-2 hover:bg-muted rounded-lg"
                        >
                          <Play size={18} className="text-muted-foreground" />
                        </button>
                      )}
                      <button onClick={(e) => handleDeleteDeck(deck.id, e)} className="p-2 hover:bg-muted rounded-lg">
                        <Trash2 size={18} className="text-muted-foreground hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Quiz Create Modal */}
      {showQuizModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {quizCreateMode === "select" && "Create Test"}
                {quizCreateMode === "paste" && "Paste Text"}
                {quizCreateMode === "upload" && "Upload File"}
                {quizCreateMode === "empty" && "New Test"}
              </h2>
              <button onClick={closeQuizModal} className="p-1 hover:bg-muted rounded">
                <X size={20} />
              </button>
            </div>

            {/* Mode Selection */}
            {quizCreateMode === "select" && (
              <div className="space-y-3">
                <button
                  onClick={() => setQuizCreateMode("paste")}
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
                  onClick={() => setQuizCreateMode("upload")}
                  className="w-full flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-muted text-left"
                >
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Upload size={20} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Upload File</p>
                    <p className="text-sm text-muted-foreground">Generate from PDF or image</p>
                  </div>
                </button>

                <button
                  onClick={() => setQuizCreateMode("empty")}
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

            {/* Paste Text Mode */}
            {quizCreateMode === "paste" && (
              <div>
                <button
                  onClick={() => setQuizCreateMode("select")}
                  className="text-sm text-muted-foreground hover:text-foreground mb-4"
                >
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
                )}

                <div className="flex gap-3">
                  <button
                    onClick={closeQuizModal}
                    className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={!isValidLength}
                    className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    Generate
                  </button>
                </div>
              </div>
            )}

            {/* Upload Mode — pick a PDF/image, extract text, then generate */}
            {quizCreateMode === "upload" && (
              <div>
                <button
                  onClick={() => { setQuizCreateMode("select"); setPasteText(""); resetUploadState(); }}
                  className="text-sm text-muted-foreground hover:text-foreground mb-4"
                >
                  ← Back
                </button>

                {/* File picker — disabled while we're extracting or already have a file loaded */}
                {!uploadedFileName && !extracting && (
                  <label className="block w-full border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-muted/30">
                    <Upload size={28} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium mb-1">Click to upload</p>
                    <p className="text-xs text-muted-foreground">PDF, PNG, or JPG (max 20MB)</p>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileUpload(e, "quiz")}
                      className="hidden"
                    />
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

                {/* File loaded — show filename, char count, and the same config knobs as Paste */}
                {uploadedFileName && !extracting && (
                  <>
                    <div className="p-4 border border-border rounded-xl mb-4 flex items-start gap-3">
                      <FileText size={20} className="text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{uploadedFileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {charCount.toLocaleString()} characters
                          {extractMethod === "pdf-ocr" && " · OCR'd"}
                          {extractMethod === "image-ocr" && " · OCR'd"}
                        </p>
                      </div>
                    </div>

                    {charCount > 0 && !isValidLength && (
                      <p className="text-xs text-red-500 mb-3">
                        Need between {MIN_CHARS} and {MAX_CHARS.toLocaleString()} characters — your file had {charCount.toLocaleString()}.
                      </p>
                    )}

                    {isValidLength && (
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
                    )}
                  </>
                )}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={closeQuizModal}
                    className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={!isValidLength || extracting}
                    className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm disabled:opacity-50"
                  >
                    Generate
                  </button>
                </div>
              </div>
            )}

            {/* Empty Quiz Mode */}
            {quizCreateMode === "empty" && (
              <div>
                <button
                  onClick={() => setQuizCreateMode("select")}
                  className="text-sm text-muted-foreground hover:text-foreground mb-4"
                >
                  ← Back
                </button>

                <input
                  type="text"
                  placeholder="Test title"
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
                  <button
                    onClick={closeQuizModal}
                    className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateEmptyQuiz}
                    disabled={!newTitle.trim() || creating}
                    className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flashcard Deck Modal — same structure as the quiz modal: pick a mode, then do your thing */}
      {showDeckModal && (() => {
        // Reuse the existing char-length validators since the AI generator behaves the same.
        const deckCharCount = deckPasteText.length;
        const deckValidLength = deckCharCount >= MIN_CHARS && deckCharCount <= MAX_CHARS;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">
                  {deckCreateMode === "select" && "Create Deck"}
                  {deckCreateMode === "paste" && "Paste Text"}
                  {deckCreateMode === "upload" && "Upload File"}
                  {deckCreateMode === "empty" && "New Deck"}
                </h2>
                <button onClick={closeDeckModal} className="p-1 hover:bg-muted rounded">
                  <X size={20} />
                </button>
              </div>

              {/* Mode picker */}
              {deckCreateMode === "select" && (
                <div className="space-y-3">
                  <button
                    onClick={() => setDeckCreateMode("paste")}
                    className="w-full flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-muted text-left"
                  >
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <ClipboardPaste size={20} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Paste Text</p>
                      <p className="text-sm text-muted-foreground">Generate cards from your notes</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setDeckCreateMode("upload")}
                    className="w-full flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-muted text-left"
                  >
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <Upload size={20} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Upload File</p>
                      <p className="text-sm text-muted-foreground">Generate from PDF or image</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setDeckCreateMode("empty")}
                    className="w-full flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-muted text-left"
                  >
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <Plus size={20} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Create Empty</p>
                      <p className="text-sm text-muted-foreground">Add cards manually</p>
                    </div>
                  </button>
                </div>
              )}

              {/* Paste mode */}
              {deckCreateMode === "paste" && (
                <div>
                  <button
                    onClick={() => setDeckCreateMode("select")}
                    className="text-sm text-muted-foreground hover:text-foreground mb-4"
                  >
                    ← Back
                  </button>

                  <textarea
                    value={deckPasteText}
                    onChange={(e) => setDeckPasteText(e.target.value)}
                    placeholder="Paste your notes here (min 300 characters)..."
                    className="w-full h-40 bg-background border border-border rounded-lg px-4 py-3 text-sm resize-none mb-3"
                  />

                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs text-muted-foreground">{deckCharCount} characters</span>
                    {deckCharCount > 0 && !deckValidLength && (
                      <span className="text-xs text-red-500">Min 300, max 100,000</span>
                    )}
                  </div>

                  {deckValidLength && (
                    <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-sm">Cards:</span>
                        <select
                          value={deckCardCount}
                          onChange={(e) => setDeckCardCount(Number(e.target.value))}
                          className="bg-background border border-border rounded px-2 py-1 text-sm"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={15}>15</option>
                          <option value={20}>20</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={closeDeckModal}
                      className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateDeck}
                      disabled={!deckValidLength}
                      className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm disabled:opacity-50"
                    >
                      Generate
                    </button>
                  </div>
                </div>
              )}

              {/* Upload mode — PDF/image → extract → generate */}
              {deckCreateMode === "upload" && (
                <div>
                  <button
                    onClick={() => { setDeckCreateMode("select"); setDeckPasteText(""); resetUploadState(); }}
                    className="text-sm text-muted-foreground hover:text-foreground mb-4"
                  >
                    ← Back
                  </button>

                  {!uploadedFileName && !extracting && (
                    <label className="block w-full border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-muted/30">
                      <Upload size={28} className="mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium mb-1">Click to upload</p>
                      <p className="text-xs text-muted-foreground">PDF, PNG, or JPG (max 20MB)</p>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => handleFileUpload(e, "deck")}
                        className="hidden"
                      />
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
                            {deckCharCount.toLocaleString()} characters
                            {extractMethod === "pdf-ocr" && " · OCR'd"}
                            {extractMethod === "image-ocr" && " · OCR'd"}
                          </p>
                        </div>
                      </div>

                      {deckCharCount > 0 && !deckValidLength && (
                        <p className="text-xs text-red-500 mb-3">
                          Need between {MIN_CHARS} and {MAX_CHARS.toLocaleString()} characters — your file had {deckCharCount.toLocaleString()}.
                        </p>
                      )}

                      {deckValidLength && (
                        <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-sm">Cards:</span>
                            <select
                              value={deckCardCount}
                              onChange={(e) => setDeckCardCount(Number(e.target.value))}
                              className="bg-background border border-border rounded px-2 py-1 text-sm"
                            >
                              <option value={5}>5</option>
                              <option value={10}>10</option>
                              <option value={15}>15</option>
                              <option value={20}>20</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={closeDeckModal}
                      className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateDeck}
                      disabled={!deckValidLength || extracting}
                      className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm disabled:opacity-50"
                    >
                      Generate
                    </button>
                  </div>
                </div>
              )}

              {/* Empty mode — the original create-blank-deck flow */}
              {deckCreateMode === "empty" && (
                <div>
                  <button
                    onClick={() => setDeckCreateMode("select")}
                    className="text-sm text-muted-foreground hover:text-foreground mb-4"
                  >
                    ← Back
                  </button>

                  <input
                    type="text"
                    placeholder="Deck title"
                    value={deckTitle}
                    onChange={(e) => setDeckTitle(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 mb-3 text-sm"
                    autoFocus
                  />

                  <textarea
                    placeholder="Description (optional)"
                    value={deckDesc}
                    onChange={(e) => setDeckDesc(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 mb-4 resize-none text-sm"
                    rows={3}
                  />

                  <div className="flex gap-3">
                    <button
                      onClick={closeDeckModal}
                      className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateDeck}
                      disabled={!deckTitle.trim() || creating}
                      className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm disabled:opacity-50"
                    >
                      {creating ? "Creating..." : "Create"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}