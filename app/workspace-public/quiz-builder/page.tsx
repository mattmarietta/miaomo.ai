"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/Auth";
import { Quiz, getUserQuizzes, createQuiz, deleteQuiz, updateQuiz } from "@/lib/firebase/quizStore";
import { Flashcard, getUserDecks, createDeck, deleteDeck } from "@/lib/firebase/flashcardStore";
import { ArrowLeft, Plus, FileText, Trash2, Play, Sparkles, Layers, X } from "lucide-react";
import type { GenerateQuizInput } from "./QuizCreateModal";

// Lazy-load the big create-quiz modal so it doesn't bloat the page bundle.
const QuizCreateModal = dynamic(
  () => import("./QuizCreateModal").then((m) => ({ default: m.QuizCreateModal })),
  { ssr: false }
);

type Tab = "quizzes" | "flashcards";

export default function StudyToolsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [decks, setDecks] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("quizzes");

  // Quiz modal owns its own state. Page just toggles visibility.
  const [showQuizModal, setShowQuizModal] = useState(false);

  // Generation overlay (covers full screen while creating + calling AI)
  const [generating, setGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState("");

  // Deck create modal (kept inline since it's small)
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [deckTitle, setDeckTitle] = useState("");
  const [deckDesc, setDeckDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    async function load() {
      if (!user) return;
      try {
        const [quizData, deckData] = await Promise.all([
          getUserQuizzes(user.uid),
          getUserDecks(user.uid),
        ]);
        setQuizzes(quizData);
        setDecks(deckData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [user]);

  // Empty quiz path (no AI, just create + navigate to editor)
  async function handleCreateEmpty(title: string, description: string) {
    if (!user) return;
    try {
      const quiz = await createQuiz(user.uid, title, description);
      router.push(`/workspace-public/quiz-builder/${quiz.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create quiz");
    }
  }

  // AI generation path. Same flow for paste/upload/RAG; the modal builds the input.
  async function handleGenerate(input: GenerateQuizInput) {
    if (!user) return;
    setShowQuizModal(false);
    setGenerating(true);
    setGeneratingStatus("Creating quiz...");
    try {
      const quiz = await createQuiz(user.uid, input.title, input.description, input.source);
      setGeneratingStatus("Generating questions...");
      const token = await user.getIdToken();
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: input.text, count: input.count, types: input.types }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const { questions } = await res.json();
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

  // Create flashcard deck
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

  // Block only on auth so we don't hand a broken page to a logged-out user.
  // Data loading is handled inline below (empty state + spinner inside the lists)
  // so the page renders the moment its bundle is ready, not after Firestore round-trips.
  if (authLoading) {
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
          <Sparkles size={28} className="text-muted-foreground" />
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
          <button onClick={() => router.push("/workspace")} className="p-2 hover:bg-muted rounded-lg">
            <ArrowLeft size={20} className="text-muted-foreground" />
          </button>
          <div>
            <h1 className="font-semibold">Study Tools</h1>
            <p className="text-xs text-muted-foreground">Quizzes and flashcards</p>
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
            Quizzes
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
              onClick={() => setShowQuizModal(true)}
              className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-muted-foreground hover:text-foreground mb-6"
            >
              <Plus size={20} />
              <span className="font-medium">Create Quiz</span>
            </button>

            {isLoading ? (
              <div className="flex flex-col items-center py-16">
                <p className="text-sm text-muted-foreground">Loading quizzes...</p>
              </div>
            ) : quizzes.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <FileText size={40} className="text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">No quizzes yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Create your first quiz from your uploaded files</p>
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
              onClick={() => setShowDeckModal(true)}
              className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-muted-foreground hover:text-foreground mb-6"
            >
              <Plus size={20} />
              <span className="font-medium">Create Deck</span>
            </button>

            {isLoading ? (
              <div className="flex flex-col items-center py-16">
                <p className="text-sm text-muted-foreground">Loading decks...</p>
              </div>
            ) : decks.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <Layers size={40} className="text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">No flashcard decks yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Create your first deck from your uploaded files</p>
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

      {/* Quiz Create Modal (lazy-loaded) */}
      {showQuizModal && user && (
        <QuizCreateModal
          userId={user.uid}
          onClose={() => setShowQuizModal(false)}
          onCreateEmpty={handleCreateEmpty}
          onGenerate={handleGenerate}
        />
      )}

      {/* Flashcard Deck Modal */}
      {showDeckModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Create Deck</h2>
              <button onClick={() => setShowDeckModal(false)} className="p-1 hover:bg-muted rounded">
                <X size={20} />
              </button>
            </div>
            
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
                onClick={() => { setShowDeckModal(false); setDeckTitle(""); setDeckDesc(""); }}
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
        </div>
      )}
    </div>
  );
}