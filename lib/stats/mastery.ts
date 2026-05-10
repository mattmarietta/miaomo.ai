// Pure helpers for computing mastery percentages.
// No Firestore here. Pass already-loaded data in, get numbers back.

import type { Card, Flashcard } from "@/lib/firebase/flashcardStore";
import type { Question, Quiz } from "@/lib/firebase/quizStore";

// Flashcard SM-2: repetition is consecutive correct answers, resets to 0 on miss.
// 3 in a row counts as fully learned.
export function getCardMastery(card: Card): number {
  return Math.min(card.repetition / 3, 1) * 100;
}

// Quiz question box ranges 1 (just learned) to 5 (mastered).
export function getQuestionMastery(q: Question): number {
  return ((q.box - 1) / 4) * 100;
}

// Average mastery for a single file. null = no quizzes/decks tied to this file yet.
export function getFileMastery(
  fileId: string,
  decks: Flashcard[],
  quizzes: Quiz[]
): number | null {
  const cardScores = decks
    .filter((d) => d.sourceFileIds?.includes(fileId))
    .flatMap((d) => d.cards.map(getCardMastery));

  const questionScores = quizzes
    .filter((q) => q.sourceFileIds?.includes(fileId))
    .flatMap((q) => q.questions.map(getQuestionMastery));

  const all = [...cardScores, ...questionScores];
  if (all.length === 0) return null;

  const sum = all.reduce((a, b) => a + b, 0);
  return Math.round(sum / all.length);
}

// Average across files that have data. null = nothing studied yet.
export function getWorkspaceMastery(
  fileIds: string[],
  decks: Flashcard[],
  quizzes: Quiz[]
): number | null {
  const scores = fileIds
    .map((id) => getFileMastery(id, decks, quizzes))
    .filter((m): m is number => m !== null);

  if (scores.length === 0) return null;

  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round(sum / scores.length);
}

// Same color buckets the original UI used.
export function masteryBarColor(pct: number): string {
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 45) return "bg-amber-400";
  return "bg-rose-500";
}

export function masteryTextColor(pct: number): string {
  if (pct >= 70) return "text-emerald-600";
  if (pct >= 45) return "text-amber-500";
  return "text-rose-500";
}
