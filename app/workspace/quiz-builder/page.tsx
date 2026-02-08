"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/Auth";
import { Quiz, getUserQuizzes, createQuiz, deleteQuiz, updateQuiz } from "@/lib/firebase/quizStore";
import { generateQuestionsFromText } from "@/lib/aiQuizGenerator";
import { ArrowLeft, Plus, FileText, Trash2, Play, Sparkles, Layers } from "lucide-react";

type Tab = "study-sets" | "paste-text";

// Character limits for paste text
const MIN_CHARS = 300;
const MAX_CHARS = 100000;

export default function QuizBuilderPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Quiz list state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Tab navigation
  const [activeTab, setActiveTab] = useState<Tab>("study-sets");
  
  // Create modal state
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Paste text generation state
  const [pasteText, setPasteText] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState("");
  
  // Question type toggles
  const [includeMultipleChoice, setIncludeMultipleChoice] = useState(true);
  const [includeTrueFalse, setIncludeTrueFalse] = useState(true);
  const [includeWritten, setIncludeWritten] = useState(true);
  const [includeMatching, setIncludeMatching] = useState(false);

  // Text validation
  const charCount = pasteText.length;
  const isValidLength = charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const showCharWarning = charCount > 0 && !isValidLength;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
  }, [authLoading, user, router]);

  // Load user's quizzes
  useEffect(() => {
    if (!user) return;

    async function load() {
      if (!user) return;
      try {
        const data = await getUserQuizzes(user.uid);
        setQuizzes(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [user]);

  // Create empty study set manually
  async function handleCreate() {
    if (!user || !newTitle.trim()) return;
    setCreating(true);
    try {
      const quiz = await createQuiz(user.uid, newTitle.trim(), newDesc.trim());
      router.push(`/workspace/quiz-builder/${quiz.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create quiz");
      setCreating(false);
    }
  }

  // Generate quiz from pasted text using AI
  async function handleGenerate() {
    if (!user || !isValidLength) return;
    
    // Collect selected question types
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
    setGeneratingStatus("Creating study set...");

    try {
      // Create title from first line of text
      const firstLine = pasteText.split('\n')[0] || pasteText;
      const title = firstLine.substring(0, 50).trim() + (firstLine.length > 50 ? "..." : "");
      
      // Create quiz in Firebase
      const quiz = await createQuiz(user.uid, title, "Generated from pasted text");
      
      setGeneratingStatus("Extracting concepts...");
      
      // Generate questions with AI
      const questions = await generateQuestionsFromText(pasteText, questionCount, types);
      
      setGeneratingStatus("Saving questions...");
      
      // Save questions to quiz
      await updateQuiz(quiz.id, { questions });
      
      // Navigate to quiz editor
      router.push(`/workspace/quiz-builder/${quiz.id}`);
      
    } catch (err) {
      console.error(err);
      alert("Failed to generate quiz. Please try again.");
      setGenerating(false);
      setGeneratingStatus("");
    }
  }

  // Delete a study set
  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this study set?")) return;
    try {
      await deleteQuiz(id);
      setQuizzes(quizzes.filter(q => q.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  // Clear paste text area
  function handleClear() {
    setPasteText("");
  }

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  // Generating state - show progress screen
  if (generating) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-6 animate-pulse">
          <Sparkles size={28} className="text-muted-foreground" />
        </div>
        <h2 className="text-xl font-medium text-foreground mb-2">{generatingStatus}</h2>
        <p className="text-sm text-muted-foreground">This may take a moment</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/workspace")}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-muted-foreground" />
            </button>
            <div>
              <h1 className="font-semibold text-foreground">Quiz Builder</h1>
              <p className="text-xs text-muted-foreground">Generate practice tests from your notes</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 pb-32">
        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit mb-8">
          <button
            onClick={() => setActiveTab("study-sets")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "study-sets"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Study Sets
          </button>
          <button
            onClick={() => setActiveTab("paste-text")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "paste-text"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Paste Text
          </button>
          {/* Flashcards - Coming Soon */}
          <button
            disabled
            className="px-4 py-2 text-sm font-medium rounded-md text-muted-foreground/50 cursor-not-allowed flex items-center gap-2"
            title="Coming soon"
          >
            <Layers size={14} />
            Flashcards
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Soon</span>
          </button>
        </div>

        {/* Study Sets Tab */}
        {activeTab === "study-sets" && (
          <div>
            {/* Create New Button */}
            <button
              onClick={() => setShowModal(true)}
              className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <Plus size={20} />
              <span className="font-medium">Create new study set</span>
            </button>

            {/* Empty State */}
            {quizzes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <FileText size={40} className="text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No study sets yet</p>
              </div>
            ) : (
              /* Quiz List */
              <div className="space-y-2">
                {quizzes.map(quiz => (
                  <div
                    key={quiz.id}
                    onClick={() => router.push(`/workspace/quiz-builder/${quiz.id}`)}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        <FileText size={20} className="text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{quiz.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {quiz.questions.length} {quiz.questions.length === 1 ? "question" : "questions"}
                        </p>
                      </div>
                    </div>
                    {/* Action Buttons - Visible on Hover */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {quiz.questions.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/workspace/quiz-builder/${quiz.id}/take`);
                          }}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="Take test"
                        >
                          <Play size={18} className="text-muted-foreground" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(quiz.id, e)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} className="text-muted-foreground hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Paste Text Tab */}
        {activeTab === "paste-text" && (
          <div>
            {/* Text Input */}
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your notes, textbook content, or any study material here..."
              className="w-full h-64 p-4 bg-card border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm leading-relaxed"
            />
            
            {/* Character Count & Clear */}
            <div className="flex justify-between items-center mt-3">
              <button
                onClick={handleClear}
                disabled={!pasteText}
                className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Clear
              </button>
              
              {showCharWarning && (
                <p className="text-sm text-red-500">
                  Text must be between {MIN_CHARS.toLocaleString()} and {MAX_CHARS.toLocaleString()} characters
                </p>
              )}
              
              {isValidLength && (
                <p className="text-sm text-muted-foreground">
                  {charCount.toLocaleString()} characters
                </p>
              )}
            </div>
            
            {/*Show when text is valid */}
            {isValidLength && (
              <div className="mt-6 p-5 bg-card border border-border rounded-xl">
                <h3 className="font-medium mb-4">Question Types</h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeMultipleChoice}
                      onChange={(e) => setIncludeMultipleChoice(e.target.checked)}
                      className="w-4 h-4 rounded border-border"
                    />
                    <span className="text-sm">Multiple choice</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTrueFalse}
                      onChange={(e) => setIncludeTrueFalse(e.target.checked)}
                      className="w-4 h-4 rounded border-border"
                    />
                    <span className="text-sm">True / False</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeWritten}
                      onChange={(e) => setIncludeWritten(e.target.checked)}
                      className="w-4 h-4 rounded border-border"
                    />
                    <span className="text-sm">Written</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeMatching}
                      onChange={(e) => setIncludeMatching(e.target.checked)}
                      className="w-4 h-4 rounded border-border"
                    />
                    <span className="text-sm">Matching</span>
                  </label>
                </div>
                
                {/* Question Count Selector */}
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Number of questions:</span>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Generate Bar */}
      {activeTab === "paste-text" && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <p className="text-xs text-muted-foreground max-w-md">
              AI-generated content may contain errors. Review your quiz before using.
            </p>
            <button
              onClick={handleGenerate}
              disabled={!isValidLength}
              className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-lg font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              <Sparkles size={16} />
              Generate
            </button>
          </div>
        </div>
      )}

      {/* Create Study Set Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Create Study Set</h2>
            
            <input
              type="text"
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              autoFocus
            />
            
            <textarea
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              rows={3}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => { setShowModal(false); setNewTitle(""); setNewDesc(""); }}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg font-medium text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || creating}
                className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg font-medium text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}