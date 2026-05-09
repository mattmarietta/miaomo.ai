"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/Auth";
import { Flashcard, Card, getDeck, updateDeck, createNewCard } from "@/lib/firebase/flashcardStore";
import { generateFlashcardsFromText } from "@/lib/aiFlashcardGenerator";
import { ArrowLeft, Plus, Trash2, Play, X, Upload, Pencil, Sparkles, Brain, ClipboardCheck } from "lucide-react";
export default function DeckEditorPage() {
  const router = useRouter();
  const params = useParams();
  const deckId = params.deckId as string;
  const { user, loading: authLoading } = useAuth();

  const [deck, setDeck] = useState<Flashcard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add card modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");

  // Edit card modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");

  // AI generate modal
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!deckId) return;

    async function load() {
      try {
        const data = await getDeck(deckId);
        if (!data) {
          router.replace("/workspace-public/quiz-builder");
          return;
        }
        setDeck(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [deckId, router]);

  // Save deck to Firebase
  async function saveDeck(cards: Card[]) {
    if (!deck) return;
    setSaving(true);
    try {
      await updateDeck(deck.id, { cards });
      setDeck({ ...deck, cards });
    } catch (err) {
      console.error(err);
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Add a new card
  function handleAddCard() {
    if (!newFront.trim() || !newBack.trim() || !deck) return;
    
    const card = createNewCard(newFront.trim(), newBack.trim());
    const newCards = [...deck.cards, card];
    saveDeck(newCards);
    
    setNewFront("");
    setNewBack("");
    setShowAddModal(false);
  }

  // Open edit modal
  function openEditModal(card: Card) {
    setEditingCard(card);
    setEditFront(card.front);
    setEditBack(card.back);
    setShowEditModal(true);
  }

  // Save edited card
  function handleEditCard() {
    if (!editFront.trim() || !editBack.trim() || !deck || !editingCard) return;
    
    const updatedCards = deck.cards.map(c => 
      c.id === editingCard.id 
        ? { ...c, front: editFront.trim(), back: editBack.trim() }
        : c
    );
    saveDeck(updatedCards);
    
    setShowEditModal(false);
    setEditingCard(null);
    setEditFront("");
    setEditBack("");
  }

  // Delete a card
  function handleDeleteCard(cardId: string) {
    if (!deck || !confirm("Delete this card?")) return;
    const newCards = deck.cards.filter(c => c.id !== cardId);
    saveDeck(newCards);
  }

  // AI generate cards
  async function handleAIGenerate() {
    if (!deck || aiText.length < 100) return;
    
    setGenerating(true);
    try {
      const aiCards = await generateFlashcardsFromText(aiText, aiCount);
      const newCards = [
        ...deck.cards,
        ...aiCards.map(c => createNewCard(c.front, c.back))
      ];
      await saveDeck(newCards);
      setAiText("");
      setShowAIModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to generate cards");
    } finally {
      setGenerating(false);
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!deck) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Slim header — just back, title, save indicator */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/workspace-public/quiz-builder")} className="p-2 hover:bg-muted rounded-lg">
              <ArrowLeft size={20} className="text-muted-foreground" />
            </button>
            <div>
              <h1 className="font-semibold">{deck.title}</h1>
              <p className="text-xs text-muted-foreground">{deck.cards.length} cards</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-muted-foreground">Saving...</span>}
            {deck.cards.length > 0 && (
              <button
                onClick={() => router.push(`/workspace-public/quiz-builder/flashcards/${deckId}/study`)}
                className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium"
              >
                <Play size={16} />
                Study
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* Study mode tiles — the main thing on this page */}
        {deck.cards.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Study with this deck
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => router.push(`/workspace-public/quiz-builder/flashcards/${deckId}/study`)}
                className="group flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:border-foreground/30 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-foreground/10 flex items-center justify-center flex-shrink-0">
                  <Play size={18} className="text-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">Study</p>
                  <p className="text-xs text-muted-foreground">Flip cards, spaced repetition</p>
                </div>
              </button>

              <button
                onClick={() => deck.cards.length >= 2 && router.push(`/workspace-public/quiz-builder/flashcards/${deckId}/learn`)}
                disabled={deck.cards.length < 2}
                className="group flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:border-foreground/30 hover:bg-muted/30 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-card"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Brain size={18} className="text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">Learn</p>
                  <p className="text-xs text-muted-foreground">Multiple choice mastery</p>
                </div>
              </button>

              <button
                onClick={() => deck.cards.length >= 2 && router.push(`/workspace-public/quiz-builder/flashcards/${deckId}/test`)}
                disabled={deck.cards.length < 2}
                className="group flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:border-foreground/30 hover:bg-muted/30 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-card"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <ClipboardCheck size={18} className="text-indigo-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">Test</p>
                  <p className="text-xs text-muted-foreground">Graded mixed quiz</p>
                </div>
              </button>
            </div>

            {deck.cards.length < 2 && (
              <p className="text-xs text-muted-foreground mt-3">
                Add at least 2 cards to unlock Learn and Test.
              </p>
            )}
          </section>
        )}

        {/* Manage cards section header + actions */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
            Cards
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAIModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90"
            >
              <Sparkles size={14} />
              AI Generate
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted"
            >
              <Plus size={14} />
              Add
            </button>
            <button
              disabled
              title="Coming soon — upload PDF/image to generate cards"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs opacity-40 cursor-not-allowed"
            >
              <Upload size={14} />
              Upload
            </button>
          </div>
        </div>

        {/* Cards list */}
        {deck.cards.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <p className="text-muted-foreground mb-4">No cards yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-sm text-foreground underline"
            >
              Add your first card
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {deck.cards.map((card, index) => (
              <div key={card.id} className="p-4 bg-card border border-border rounded-xl">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Card {index + 1}</p>
                    <p className="font-medium mb-2">{card.front}</p>
                    <p className="text-sm text-muted-foreground">{card.back}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(card)}
                      className="p-2 hover:bg-muted rounded-lg"
                    >
                      <Pencil size={16} className="text-muted-foreground hover:text-foreground" />
                    </button>
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="p-2 hover:bg-muted rounded-lg"
                    >
                      <Trash2 size={16} className="text-muted-foreground hover:text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Add Card</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-muted rounded">
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-3">
              <label className="text-sm text-muted-foreground mb-1 block">Front (term/question)</label>
              <input
                type="text"
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm"
                placeholder="Enter term or question"
                autoFocus
              />
            </div>
            
            <div className="mb-4">
              <label className="text-sm text-muted-foreground mb-1 block">Back (definition/answer)</label>
              <textarea
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm resize-none"
                placeholder="Enter definition or answer"
                rows={3}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCard}
                disabled={!newFront.trim() || !newBack.trim()}
                className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Card Modal */}
      {showEditModal && editingCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Edit Card</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-muted rounded">
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-3">
              <label className="text-sm text-muted-foreground mb-1 block">Front (term/question)</label>
              <input
                type="text"
                value={editFront}
                onChange={(e) => setEditFront(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm"
                autoFocus
              />
            </div>
            
            <div className="mb-4">
              <label className="text-sm text-muted-foreground mb-1 block">Back (definition/answer)</label>
              <textarea
                value={editBack}
                onChange={(e) => setEditBack(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm resize-none"
                rows={3}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleEditCard}
                disabled={!editFront.trim() || !editBack.trim()}
                className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">AI Generate Cards</h2>
              <button onClick={() => setShowAIModal(false)} className="p-1 hover:bg-muted rounded">
                <X size={20} />
              </button>
            </div>
            
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              className="w-full h-48 bg-background border border-border rounded-lg px-4 py-3 text-sm resize-none mb-3"
              placeholder="Paste your notes here (min 100 characters)..."
            />
            
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-muted-foreground">Cards to generate:</span>
              <select
                value={aiCount}
                onChange={(e) => setAiCount(Number(e.target.value))}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
              </select>
              <span className="text-xs text-muted-foreground ml-auto">{aiText.length} characters</span>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowAIModal(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleAIGenerate}
                disabled={aiText.length < 100 || generating}
                className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}