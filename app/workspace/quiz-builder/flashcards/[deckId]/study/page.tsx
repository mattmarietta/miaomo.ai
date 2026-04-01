"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/Auth";
import { Flashcard, Card, getDeck, updateDeck, practiceCard } from "@/lib/firebase/flashcardStore";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { SuperMemoGrade } from "supermemo";

function fisherYatesShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function StudyPage() {
  const router = useRouter();
  const params = useParams();
  const deckId = params.deckId as string;
  const { user, loading: authLoading } = useAuth();

  const [deck, setDeck] = useState<Flashcard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Study state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyCards, setStudyCards] = useState<Card[]>([]);
  const [stillLearning, setStillLearning] = useState<Card[]>([]);
  const [almostCards, setAlmostCards] = useState<Card[]>([]);
  const [completed, setCompleted] = useState(false);
  const [round, setRound] = useState(1);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!deckId) return;

    async function load() {
      try {
        const data = await getDeck(deckId);
        if (!data || data.cards.length === 0) {
          router.replace(`/workspace/quiz-builder/flashcards/${deckId}`);
          return;
        }
        setDeck(data);
        setStudyCards(fisherYatesShuffle(data.cards));
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [deckId, router]);

  async function handleRate(rating: "still" | "almost" | "got") {
    if (!deck) return;

    const card = studyCards[currentIndex];
    
    // Map to SM 2 grades for algorithm
    const gradeMap: Record<string, SuperMemoGrade> = {
      still: 1,
      almost: 3,
      got: 5,
    };
    
    const updatedCard = practiceCard(card, gradeMap[rating]);

    // Update card in Firebase
    const updatedCards = deck.cards.map(c => c.id === card.id ? updatedCard : c);
    await updateDeck(deck.id, { cards: updatedCards });
    setDeck({ ...deck, cards: updatedCards });

    // Sort into piles
    if (rating === "still") {
      setStillLearning(prev => [...prev, updatedCard]);
    } else if (rating === "almost") {
      setAlmostCards(prev => [...prev, updatedCard]);
    }

    // Move to next card
    if (currentIndex < studyCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      const newStillLearning = rating === "still" ? [...stillLearning, updatedCard] : stillLearning;
      const newAlmost = rating === "almost" ? [...almostCards, updatedCard] : almostCards;

      if (newStillLearning.length > 0) {
        setStudyCards(fisherYatesShuffle(newStillLearning));
        setStillLearning([]);
        // Keep almost cards for later
      } else if (newAlmost.length > 0) {
        // Then review "almost" cards once
        setStudyCards(fisherYatesShuffle(newAlmost));
        setAlmostCards([]);
      } else {
        setCompleted(true);
        return;
      }
      
      setCurrentIndex(0);
      setIsFlipped(false);
      setRound(prev => prev + 1);
    }
  }

  function handleRestart() {
    if (!deck) return;
    setStudyCards(fisherYatesShuffle(deck.cards));
    setStillLearning([]);
    setAlmostCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setCompleted(false);
    setRound(1);
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!deck) return null;

  const currentCard = studyCards[currentIndex];

  if (completed) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-semibold mb-2">All caught up!</h1>
        <p className="text-muted-foreground mb-8">You mastered all {deck.cards.length} cards!</p>
        
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/workspace/quiz-builder/flashcards/${deckId}`)}
            className="px-6 py-3 border border-border rounded-lg text-sm hover:bg-muted"
          >
            Back to Deck
          </button>
          <button
            onClick={handleRestart}
            className="px-6 py-3 bg-foreground text-background rounded-lg text-sm flex items-center gap-2"
          >
            <RotateCcw size={16} />
            Study Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push(`/workspace/quiz-builder/flashcards/${deckId}`)}
            className="p-2 hover:bg-muted rounded-lg"
          >
            <ArrowLeft size={20} className="text-muted-foreground" />
          </button>
          
          <div className="text-center">
            <p className="text-sm font-medium">{deck.title}</p>
            <p className="text-xs text-muted-foreground">
              {currentIndex + 1} of {studyCards.length}
              {round > 1 && ` • Round ${round}`}
            </p>
          </div>
          
          <div className="w-10" />
        </div>
      </header>

      {/* Progress bar */}
      <div className="max-w-2xl mx-auto px-6 pt-4">
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: `${((currentIndex) / studyCards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Flashcard with 3D flip animation */}
      <main className="max-w-2xl mx-auto p-6 flex flex-col items-center">

        {/* Outer wrapper — sets up the 3D space with perspective */}
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className="w-full aspect-[3/2] cursor-pointer mb-8"
          style={{ perspective: "1000px" }}
        >
          {/* Inner card — this is what actually rotates */}
          <div
            className="relative w-full h-full"
            style={{
              transformStyle: "preserve-3d",
              transition: "transform 0.3s",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* Front face */}
            <div
              className="absolute inset-0 bg-card border border-border rounded-2xl p-8 flex items-center justify-center"
              style={{ backfaceVisibility: "hidden" }}
            >
              <p className="text-2xl font-medium text-center">{currentCard.front}</p>
            </div>

            {/* Back face — rotated 180deg so it shows when the card flips */}
            <div
              className="absolute inset-0 bg-card border border-border rounded-2xl p-8 flex items-center justify-center"
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <p className="text-2xl text-center">{currentCard.back}</p>
            </div>
          </div>
        </div>

        {/* Rating buttons */}
        {isFlipped && (
          <div className="w-full">
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleRate("still")}
                className="py-4 bg-red-500/10 text-red-500 rounded-xl text-sm font-medium hover:bg-red-500/20"
              >
                Still Learning
              </button>
              <button
                onClick={() => handleRate("almost")}
                className="py-4 bg-yellow-500/10 text-yellow-600 rounded-xl text-sm font-medium hover:bg-yellow-500/20"
              >
                Almost
              </button>
              <button
                onClick={() => handleRate("got")}
                className="py-4 bg-green-500/10 text-green-500 rounded-xl text-sm font-medium hover:bg-green-500/20"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}