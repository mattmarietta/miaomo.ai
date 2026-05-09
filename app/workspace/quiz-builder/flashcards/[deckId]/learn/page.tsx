"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/Auth";
import { Flashcard, Card, getDeck } from "@/lib/firebase/flashcardStore";
import { ArrowLeft, Check, X, RotateCcw, Sparkles } from "lucide-react";

// How many times a card has to be answered correctly in a row before it's "learned"
const MASTERY_TARGET = 2;

// Shuffle in place
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Build a round of 4 options for a given card — correct answer + up to 3 distractors from other cards.
// If the deck is smaller than 4, we just use however many we have.
function buildOptions(card: Card, pool: Card[]): string[] {
  const distractors = shuffle(pool.filter(c => c.id !== card.id && c.back !== card.back))
    .slice(0, 3)
    .map(c => c.back);

  return shuffle([card.back, ...distractors]);
}

export default function LearnPage() {
  const router = useRouter();
  const params = useParams();
  const deckId = params.deckId as string;
  const { user, loading: authLoading } = useAuth();

  const [deck, setDeck] = useState<Flashcard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Queue of cards still being learned (we pop from the front each round)
  const [queue, setQueue] = useState<Card[]>([]);
  // Correct streak per card — once a card hits MASTERY_TARGET, it drops out of the queue
  const [streak, setStreak] = useState<Record<string, number>>({});
  // Which cards the user has gotten wrong at least once this session (for the progress bar "still learning" color)
  const [struggled, setStruggled] = useState<Set<string>>(new Set());

  // Current question state
  const [current, setCurrent] = useState<Card | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealedCorrect, setRevealedCorrect] = useState(false); // true when user used "Don't know?"

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!deckId) return;

    async function load() {
      try {
        const data = await getDeck(deckId);
        if (!data || data.cards.length < 2) {
          // Need at least 2 cards for multiple choice to make any sense
          router.replace(`/workspace/quiz-builder/flashcards/${deckId}`);
          return;
        }
        setDeck(data);
        const shuffled = shuffle(data.cards);
        setQueue(shuffled);
        setStreak(Object.fromEntries(data.cards.map(c => [c.id, 0])));
        setCurrent(shuffled[0]);
        setOptions(buildOptions(shuffled[0], data.cards));
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [deckId, router]);

  // Mastery stats for the progress bar.
  // "familiar" = the user has touched the card (got it right once OR got it wrong),
  // but it's not fully mastered yet. Counts toward the amber "in progress" portion of the bar.
  const stats = useMemo(() => {
    if (!deck) return { learned: 0, familiar: 0, remaining: 0, total: 0 };
    let learned = 0, familiar = 0;
    for (const c of deck.cards) {
      const s = streak[c.id] ?? 0;
      if (s >= MASTERY_TARGET) learned++;
      else if (s > 0 || struggled.has(c.id)) familiar++;
    }
    return {
      learned,
      familiar,
      remaining: deck.cards.length - learned - familiar,
      total: deck.cards.length,
    };
  }, [deck, streak, struggled]);

  const sessionDone = deck && stats.learned === stats.total;

  // Move on to the next card in the queue
  function advance(nextStreak: Record<string, number>, nextQueue: Card[]) {
    // Drop cards that hit mastery
    const filtered = nextQueue.filter(c => (nextStreak[c.id] ?? 0) < MASTERY_TARGET);

    if (filtered.length === 0) {
      setQueue([]);
      setCurrent(null);
      return;
    }

    // If we emptied the queue but some cards are still unmastered, re-shuffle them for a new round
    const nextCard = filtered[0];
    setQueue(filtered);
    setCurrent(nextCard);
    setOptions(buildOptions(nextCard, deck!.cards));
    setPicked(null);
    setRevealedCorrect(false);
  }

  function handlePick(option: string) {
    if (!current || picked !== null) return;
    setPicked(option);

    const isRight = option === current.back;

    if (isRight) {
      // Bump the streak — we wait for Continue before advancing, so the user can see feedback
      const nextStreak = { ...streak, [current.id]: (streak[current.id] ?? 0) + 1 };
      setStreak(nextStreak);
    } else {
      // Wrong — reset streak, mark as struggled, wait for user to click Continue
      const nextStreak = { ...streak, [current.id]: 0 };
      setStreak(nextStreak);
      setStruggled(prev => new Set(prev).add(current.id));
    }
  }

  function handleContinue() {
    if (!current) return;
    const rest = queue.slice(1);
    const cardStreak = streak[current.id] ?? 0;
    // If the card just hit mastery, drop it; otherwise send it back to the end of the line
    const nextQueue = cardStreak >= MASTERY_TARGET ? rest : [...rest, current];
    advance(streak, nextQueue);
  }

  function handleDontKnow() {
    if (!current || picked !== null) return;
    // Treat it like a wrong answer — show the correct option and require Continue
    setPicked(""); // picked is non-null but not any real option, so nothing shows as "your pick"
    setRevealedCorrect(true);
    const nextStreak = { ...streak, [current.id]: 0 };
    setStreak(nextStreak);
    setStruggled(prev => new Set(prev).add(current.id));
  }

  function handleRestart() {
    if (!deck) return;
    const shuffled = shuffle(deck.cards);
    setQueue(shuffled);
    setStreak(Object.fromEntries(deck.cards.map(c => [c.id, 0])));
    setStruggled(new Set());
    setCurrent(shuffled[0]);
    setOptions(buildOptions(shuffled[0], deck.cards));
    setPicked(null);
    setRevealedCorrect(false);
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!deck) return null;

  // All done screen
  if (sessionDone) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
          <Sparkles size={28} className="text-emerald-400" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">You learned them all!</h1>
        <p className="text-muted-foreground mb-8">
          Mastered all {deck.cards.length} cards.
        </p>
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
            Learn Again
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const hasAnswered = picked !== null;
  const pickedCorrect = hasAnswered && picked === current.back && !revealedCorrect;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push(`/workspace/quiz-builder/flashcards/${deckId}`)}
            className="p-2 hover:bg-muted rounded-lg"
          >
            <ArrowLeft size={20} className="text-muted-foreground" />
          </button>
          <div className="text-center">
            <p className="text-sm font-medium">{deck.title}</p>
            <p className="text-xs text-muted-foreground">Learn mode</p>
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* Linear progress — emerald fill grows left-to-right as cards are mastered.
          A subtle amber sliver shows cards that are "in progress" (seen but not yet mastered). */}
      <div className="max-w-3xl w-full mx-auto px-6 pt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">
            <span className="text-emerald-400 font-medium">{stats.learned}</span> mastered · {stats.familiar} learning
          </span>
          <span className="text-xs text-muted-foreground">
            {stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0}%
          </span>
        </div>
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          {/* Familiar (in-progress) layer behind */}
          <div
            className="absolute inset-y-0 left-0 bg-amber-400/50 transition-all duration-500 ease-out"
            style={{
              width: `${stats.total > 0 ? ((stats.learned + stats.familiar) / stats.total) * 100 : 0}%`,
            }}
          />
          {/* Mastered layer in front */}
          <div
            className="absolute inset-y-0 left-0 bg-emerald-400 transition-all duration-500 ease-out"
            style={{
              width: `${stats.total > 0 ? (stats.learned / stats.total) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Question card */}
      <main className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-3xl bg-card border border-border rounded-2xl p-8 md:p-10">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
            Term
          </p>
          <p className="text-2xl md:text-3xl font-semibold leading-snug">
            {current.front}
          </p>

          {/* Feedback banner */}
          {hasAnswered && !pickedCorrect && (
            <p className="mt-8 text-sm font-medium text-amber-500">
              {revealedCorrect
                ? "No worries — here's the answer."
                : "Not quite, you're still learning!"}
            </p>
          )}
          {hasAnswered && pickedCorrect && (
            <p className="mt-8 text-sm font-medium text-emerald-400">
              Nice — you got it!
            </p>
          )}

          {/* 2x2 grid of options — bigger, more breathing room */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {options.map((opt, i) => {
              const isCorrectOption = opt === current.back;
              const isPicked = picked === opt;

              let tone = "border-border hover:border-foreground/40 hover:bg-muted/40";
              let badge = "bg-muted text-muted-foreground";
              let icon: React.ReactNode = (
                <span className="text-sm font-semibold">{i + 1}</span>
              );

              if (hasAnswered) {
                if (isCorrectOption) {
                  tone = "border-emerald-400/60 bg-emerald-500/10";
                  badge = "bg-emerald-500/20 text-emerald-400";
                  icon = <Check size={18} className="text-emerald-400" />;
                } else if (isPicked) {
                  tone = "border-rose-400/60 bg-rose-500/10";
                  badge = "bg-rose-500/20 text-rose-400";
                  icon = <X size={18} className="text-rose-400" />;
                } else {
                  tone = "border-border opacity-50";
                }
              }

              return (
                <button
                  key={opt + i}
                  onClick={() => handlePick(opt)}
                  disabled={hasAnswered}
                  className={`text-left flex items-start gap-4 rounded-xl border px-5 py-5 min-h-[88px] transition-colors disabled:cursor-default ${tone}`}
                >
                  <span
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${badge}`}
                  >
                    {icon}
                  </span>
                  <span className="text-base md:text-lg leading-relaxed">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom row: Don't know + Continue */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={handleDontKnow}
              disabled={hasAnswered}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
            >
              Don&apos;t know?
            </button>

            {hasAnswered && (
              <button
                onClick={handleContinue}
                className="px-6 py-3 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90"
              >
                Continue
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-8 text-center">
          {hasAnswered ? "Click Continue to keep going" : "Click the correct answer"}
        </p>
      </main>
    </div>
  );
}
