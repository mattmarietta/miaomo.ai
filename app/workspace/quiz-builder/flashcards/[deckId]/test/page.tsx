"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/Auth";
import { Flashcard, Card, getDeck } from "@/lib/firebase/flashcardStore";
import { ArrowLeft, Check, X, RotateCcw, Trophy, Target } from "lucide-react";

// Question types we can synthesize from a flashcard deck
type TestType = "multiple-choice" | "true-false" | "written";

// One generated question. Lives only in this session
type TestQuestion =
  | {
      id: string;
      type: "multiple-choice";
      prompt: string;     // the term
      answer: string;     // the correct definition
      options: string[];  // 4 shuffled definitions including the correct one
    }
  | {
      id: string;
      type: "true-false";
      prompt: string;     
      shownDefinition: string;
      answer: "true" | "false";
    }
  | {
      id: string;
      type: "written";
      prompt: string;
      answer: string;
    };

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Build a fresh test from the deck's cards
function buildTest(cards: Card[], count: number, types: TestType[]): TestQuestion[] {
  if (cards.length < 2 || types.length === 0) return [];

  const sourceCards = shuffle(cards).slice(0, count);
  const questions: TestQuestion[] = [];

  for (const card of sourceCards) {
    const otherDefs = cards.filter(c => c.id !== card.id).map(c => c.back);
    const type = types[Math.floor(Math.random() * types.length)];

    if (type === "multiple-choice") {
      const distractors = shuffle(otherDefs).slice(0, 3);
      questions.push({
        id: pickId(),
        type: "multiple-choice",
        prompt: card.front,
        answer: card.back,
        options: shuffle([card.back, ...distractors]),
      });
    } else if (type === "true-false") {
      const useTrue = Math.random() < 0.5;
      const shown = useTrue
        ? card.back
        : (shuffle(otherDefs)[0] ?? card.back);
      questions.push({
        id: pickId(),
        type: "true-false",
        prompt: card.front,
        shownDefinition: shown,
        answer: shown === card.back ? "true" : "false",
      });
    } else {
      questions.push({
        id: pickId(),
        type: "written",
        prompt: card.front,
        answer: card.back,
      });
    }
  }

  return questions;
}

// Loose match for written answers 
function writtenIsCorrect(userAnswer: string, expected: string): boolean {
  const norm = (s: string) =>
    s.trim().toLowerCase().replace(/[.,;:!?]+$/g, "");
  return norm(userAnswer) === norm(expected);
}

type Phase = "setup" | "taking" | "results";

export default function TestFromDeckPage() {
  const router = useRouter();
  const params = useParams();
  const deckId = params.deckId as string;
  const { user, loading: authLoading } = useAuth();

  const [deck, setDeck] = useState<Flashcard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Setup options
  const [count, setCount] = useState(10);
  const [includeMC, setIncludeMC] = useState(true);
  const [includeTF, setIncludeTF] = useState(true);
  const [includeWritten, setIncludeWritten] = useState(false);

  // Test session state
  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

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
          router.replace(`/workspace/quiz-builder/flashcards/${deckId}`);
          return;
        }
        setDeck(data);
        setCount(Math.min(10, data.cards.length));
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [deckId, router]);

  function handleStart() {
    if (!deck) return;
    const types: TestType[] = [];
    if (includeMC) types.push("multiple-choice");
    if (includeTF) types.push("true-false");
    if (includeWritten) types.push("written");

    if (types.length === 0) return;

    const generated = buildTest(deck.cards, count, types);
    setQuestions(generated);
    setAnswers({});
    setPhase("taking");
  }

  function handleSubmit() {
    setPhase("results");
  }

  function handleRetake() {
    setPhase("setup");
    setQuestions([]);
    setAnswers({});
  }

  // Score derived from current answers + question list
  const result = useMemo(() => {
    let correct = 0;
    for (const q of questions) {
      const a = answers[q.id] || "";
      if (q.type === "written") {
        if (writtenIsCorrect(a, q.answer)) correct++;
      } else {
        if (a === q.answer) correct++;
      }
    }
    return { correct, total: questions.length };
  }, [questions, answers]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!deck) return null;

  if (phase === "setup") {
    const noTypeSelected = !includeMC && !includeTF && !includeWritten;

    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border">
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
            <button
              onClick={() => router.push(`/workspace/quiz-builder/flashcards/${deckId}`)}
              className="p-2 hover:bg-muted rounded-lg"
            >
              <ArrowLeft size={20} className="text-muted-foreground" />
            </button>
            <div>
              <h1 className="font-semibold">Test: {deck.title}</h1>
              <p className="text-xs text-muted-foreground">{deck.cards.length} cards available</p>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-1">Test settings</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Questions are generated from your deck&apos;s cards.
            </p>

            <div className="mb-6">
              <label className="text-sm font-medium block mb-2">
                Number of questions: <span className="text-muted-foreground">{count}</span>
              </label>
              <input
                type="range"
                min={1}
                max={Math.min(50, deck.cards.length)}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span>
                <span>{Math.min(50, deck.cards.length)}</span>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm font-medium mb-3">Question types</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMC}
                    onChange={(e) => setIncludeMC(e.target.checked)}
                  />
                  Multiple choice
                </label>
                <label className="flex items-center gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeTF}
                    onChange={(e) => setIncludeTF(e.target.checked)}
                  />
                  True / False
                </label>
                <label className="flex items-center gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeWritten}
                    onChange={(e) => setIncludeWritten(e.target.checked)}
                  />
                  Written (type the answer)
                </label>
              </div>
              {noTypeSelected && (
                <p className="text-xs text-rose-400 mt-2">Pick at least one type.</p>
              )}
            </div>

            <button
              onClick={handleStart}
              disabled={noTypeSelected}
              className="w-full px-5 py-3 bg-foreground text-background rounded-lg font-medium text-sm disabled:opacity-50"
            >
              Start Test
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Taking phase
  if (phase === "taking") {
    const answeredCount = questions.filter(q => answers[q.id]).length;

    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={handleRetake}
              className="p-2 hover:bg-muted rounded-lg"
            >
              <ArrowLeft size={20} className="text-muted-foreground" />
            </button>
            <div className="text-center">
              <h1 className="font-semibold text-sm">{deck.title}</h1>
              <p className="text-xs text-muted-foreground">
                {answeredCount} / {questions.length} answered
              </p>
            </div>
            <div className="w-10" />
          </div>
        </header>

        <main className="max-w-3xl mx-auto p-6 space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-card border border-border rounded-xl p-5">
              <p className="text-xs text-muted-foreground mb-2">
                Question {i + 1} of {questions.length}
              </p>

              {q.type === "multiple-choice" && (
                <>
                  <p className="font-medium mb-4">{q.prompt}</p>
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const picked = answers[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                          className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                            picked
                              ? "border-foreground bg-muted"
                              : "border-border hover:bg-muted/40"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {q.type === "true-false" && (
                <>
                  <p className="font-medium mb-1">{q.prompt}</p>
                  <p className="text-sm text-muted-foreground mb-4 italic">
                    means: {q.shownDefinition}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setAnswers({ ...answers, [q.id]: "true" })}
                      className={`flex-1 py-3 rounded-lg border font-medium transition-colors ${
                        answers[q.id] === "true"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      True
                    </button>
                    <button
                      onClick={() => setAnswers({ ...answers, [q.id]: "false" })}
                      className={`flex-1 py-3 rounded-lg border font-medium transition-colors ${
                        answers[q.id] === "false"
                          ? "border-rose-500 bg-rose-500/10 text-rose-500"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      False
                    </button>
                  </div>
                </>
              )}

              {q.type === "written" && (
                <>
                  <p className="font-medium mb-3">{q.prompt}</p>
                  <input
                    type="text"
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder="Type your answer..."
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </>
              )}
            </div>
          ))}

          <button
            onClick={handleSubmit}
            className="w-full px-5 py-3 bg-foreground text-background rounded-lg font-medium text-sm"
          >
            Submit Test
          </button>
        </main>
      </div>
    );
  }

  // Results phase
  const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
  let grade = "F";
  let gradeColor = "text-rose-400";
  if (pct >= 90) { grade = "A"; gradeColor = "text-emerald-400"; }
  else if (pct >= 80) { grade = "B"; gradeColor = "text-emerald-400"; }
  else if (pct >= 70) { grade = "C"; gradeColor = "text-yellow-400"; }
  else if (pct >= 60) { grade = "D"; gradeColor = "text-orange-400"; }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="font-semibold text-center text-sm">{deck.title}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        {/* Score card */}
        <div className="bg-card border border-border rounded-xl p-8 text-center mb-8">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy size={32} className={gradeColor} />
          </div>
          <h2 className="text-xl font-semibold mb-2">Test Complete</h2>
          <div className={`text-5xl font-bold ${gradeColor} mb-2`}>{grade}</div>
          <p className="text-lg text-muted-foreground mb-1">
            {result.correct} / {result.total} correct
          </p>
          <p className="text-sm text-muted-foreground">{pct}%</p>

          <div className="flex gap-3 mt-6 justify-center">
            <button
              onClick={handleRetake}
              className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg text-sm hover:bg-muted"
            >
              <RotateCcw size={16} />
              New Test
            </button>
            <button
              onClick={() => router.push(`/workspace/quiz-builder/flashcards/${deckId}`)}
              className="px-5 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium"
            >
              Done
            </button>
          </div>
        </div>

        {/* Review */}
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target size={20} />
          Review
        </h3>

        <div className="space-y-3">
          {questions.map((q, i) => {
            const userAns = answers[q.id] || "";
            const isCorrect =
              q.type === "written"
                ? writtenIsCorrect(userAns, q.answer)
                : userAns === q.answer;

            return (
              <div
                key={q.id}
                className={`bg-card border rounded-xl p-5 ${
                  isCorrect ? "border-emerald-400/40" : "border-rose-400/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCorrect ? "bg-emerald-500/15" : "bg-rose-500/15"
                    }`}
                  >
                    {isCorrect ? (
                      <Check size={18} className="text-emerald-400" />
                    ) : (
                      <X size={18} className="text-rose-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">
                      Question {i + 1}
                    </p>
                    <p className="font-medium mb-3">{q.prompt}</p>
                    {q.type === "true-false" && (
                      <p className="text-sm text-muted-foreground italic mb-3">
                        means: {q.shownDefinition}
                      </p>
                    )}

                    <div className="space-y-2">
                      <div
                        className={`p-3 rounded-lg border text-sm ${
                          isCorrect
                            ? "border-emerald-400/40 bg-emerald-500/10"
                            : "border-rose-400/40 bg-rose-500/10"
                        }`}
                      >
                        <span className="text-muted-foreground">Your answer: </span>
                        <span className={isCorrect ? "text-emerald-400" : "text-rose-400"}>
                          {userAns || "(blank)"}
                        </span>
                      </div>
                      {!isCorrect && (
                        <div className="p-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-sm">
                          <span className="text-muted-foreground">Correct: </span>
                          <span className="text-emerald-400">{q.answer}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
