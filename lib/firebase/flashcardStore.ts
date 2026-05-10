import { db } from "@/lib/firebase/firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { supermemo, SuperMemoGrade } from "supermemo";

// Single flashcard with SM-2 fields
export type Card = {
  id: string;
  front: string;
  back: string;
  interval: number;    // days until next review
  repetition: number;  // times answered correctly in a row
  efactor: number;     // easiness factor (starts at 2.5)
  dueDate: string;     // ISO date string for next review
};

// Deck of flashcards
export type Flashcard = {
  id: string;
  userId: string;
  title: string;
  description: string;
  cards: Card[];
  createdAt: Date;
  updatedAt: Date;
  // Source workspace/files when generated from RAG, used by stats page.
  sourceWorkspaceId?: string | null;
  sourceFileIds?: string[];
};

// Generate random ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Create a new card with default SM-2 values
export function createNewCard(front: string, back: string): Card {
  return {
    id: generateId(),
    front,
    back,
    interval: 0,
    repetition: 0,
    efactor: 2.5,
    dueDate: new Date().toISOString(),
  };
}

// Practice a card and update SM-2 values
export function practiceCard(card: Card, grade: SuperMemoGrade): Card {
  const { interval, repetition, efactor } = supermemo(
    { interval: card.interval, repetition: card.repetition, efactor: card.efactor },
    grade
  );

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + interval);

  return {
    ...card,
    interval,
    repetition,
    efactor,
    dueDate: dueDate.toISOString(),
  };
}

const decksCollection = collection(db, "flashcardDecks");

// Create new deck. Pass source when generating from workspace files.
export async function createDeck(
  userId: string,
  title: string,
  description: string,
  source?: { workspaceId?: string; fileIds?: string[] }
): Promise<Flashcard> {
  const now = Timestamp.now();

  const data: Record<string, unknown> = {
    userId,
    title,
    description,
    cards: [],
    createdAt: now,
    updatedAt: now,
  };
  if (source?.workspaceId) data.sourceWorkspaceId = source.workspaceId;
  if (source?.fileIds && source.fileIds.length > 0) data.sourceFileIds = source.fileIds;

  const docRef = await addDoc(decksCollection, data);

  return {
    id: docRef.id,
    userId,
    title,
    description,
    cards: [],
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
    sourceWorkspaceId: source?.workspaceId ?? null,
    sourceFileIds: source?.fileIds ?? [],
  };
}

// Get single deck
export async function getDeck(deckId: string): Promise<Flashcard | null> {
  const docRef = doc(db, "flashcardDecks", deckId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    id: snapshot.id,
    userId: data.userId,
    title: data.title,
    description: data.description,
    cards: data.cards || [],
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
    sourceWorkspaceId: data.sourceWorkspaceId ?? null,
    sourceFileIds: data.sourceFileIds ?? [],
  };
}

// Get user's decks
export async function getUserDecks(userId: string): Promise<Flashcard[]> {
  const q = query(
    decksCollection,
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId,
      title: data.title,
      description: data.description,
      cards: data.cards || [],
      createdAt: data.createdAt?.toDate() ?? new Date(),
      updatedAt: data.updatedAt?.toDate() ?? new Date(),
      sourceWorkspaceId: data.sourceWorkspaceId ?? null,
      sourceFileIds: data.sourceFileIds ?? [],
    };
  });
}

// Update deck
export async function updateDeck(deckId: string, updates: { title?: string; description?: string; cards?: Card[] }): Promise<void> {
  const docRef = doc(db, "flashcardDecks", deckId);
  
  const cleanUpdates: Record<string, unknown> = { updatedAt: Timestamp.now() };
  
  if (updates.title !== undefined) cleanUpdates.title = updates.title;
  if (updates.description !== undefined) cleanUpdates.description = updates.description;
  if (updates.cards !== undefined) cleanUpdates.cards = updates.cards;
  
  await updateDoc(docRef, cleanUpdates);
}

// Delete deck
export async function deleteDeck(deckId: string): Promise<void> {
  const docRef = doc(db, "flashcardDecks", deckId);
  await deleteDoc(docRef);
}