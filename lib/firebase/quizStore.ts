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

// Question types supported by the quiz builder
export type QuestionType = "multiple-choice" | "true-false" | "written" | "matching";

// Multiple choice option
export type Option = {
  id: string;
  text: string;
};

// Matching question pair
export type MatchingPair = {
  id: string;
  term: string;
  definition: string;
};

// Individual question in a quiz
export type Question = {
  id: string;
  type: QuestionType;
  question: string;
  options?: Option[];
  correctAnswer: string;
  matchingPairs?: MatchingPair[];
  explanation?: string;
  points: number;
  box: number;
  lastAnsweredCorrectly?: boolean;
};

// Quiz/study set containing questions
export type Quiz = {
  id: string;
  userId: string;
  title: string;
  description: string;
  questions: Question[];
  createdAt: Date;
  updatedAt: Date;
  // Source workspace/files when generated from RAG, used by stats page.
  sourceWorkspaceId?: string | null;
  sourceFileIds?: string[];
};

// Record of a user's quiz attempt
export type QuizAttempt = {
  id: string;
  quizId: string;
  userId: string;
  answers: Record<string, string>;
  matchingAnswers?: Record<string, Record<string, string>>;
  score: number;
  totalPoints: number;
  completedAt: Date;
};

// Generate random ID for questions/options
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Firestore collection references
const quizzesCollection = collection(db, "quizzes");
const attemptsCollection = collection(db, "quizAttempts");

// Create a new quiz. Pass source when generating from workspace files.
export async function createQuiz(
  userId: string,
  title: string,
  description: string,
  source?: { workspaceId?: string; fileIds?: string[] }
): Promise<Quiz> {
  const now = Timestamp.now();

  const data: Record<string, unknown> = {
    userId,
    title,
    description,
    questions: [],
    createdAt: now,
    updatedAt: now,
  };
  if (source?.workspaceId) data.sourceWorkspaceId = source.workspaceId;
  if (source?.fileIds && source.fileIds.length > 0) data.sourceFileIds = source.fileIds;

  const docRef = await addDoc(quizzesCollection, data);

  return {
    id: docRef.id,
    userId,
    title,
    description,
    questions: [],
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
    sourceWorkspaceId: source?.workspaceId ?? null,
    sourceFileIds: source?.fileIds ?? [],
  };
}

// Get a single quiz by ID
export async function getQuiz(quizId: string): Promise<Quiz | null> {
  const docRef = doc(db, "quizzes", quizId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    id: snapshot.id,
    userId: data.userId,
    title: data.title,
    description: data.description,
    questions: data.questions || [],
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
    sourceWorkspaceId: data.sourceWorkspaceId ?? null,
    sourceFileIds: data.sourceFileIds ?? [],
  };
}

// Get all quizzes for a user, sorted by most recent
export async function getUserQuizzes(userId: string): Promise<Quiz[]> {
  const q = query(
    quizzesCollection,
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );

  const snapshot = await getDocs(q);
  const quizzes: Quiz[] = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    quizzes.push({
      id: doc.id,
      userId: data.userId,
      title: data.title,
      description: data.description,
      questions: data.questions || [],
      createdAt: data.createdAt?.toDate() ?? new Date(),
      updatedAt: data.updatedAt?.toDate() ?? new Date(),
      sourceWorkspaceId: data.sourceWorkspaceId ?? null,
      sourceFileIds: data.sourceFileIds ?? [],
    });
  });

  return quizzes;
}

// Update quiz fields
export async function updateQuiz(
  quizId: string,
  updates: {
    title?: string;
    description?: string;
    questions?: Question[];
  }
): Promise<void> {
  const docRef = doc(db, "quizzes", quizId);
  
  // Clean updates to remove undefined values
  const cleanUpdates: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };
  
  if (updates.title !== undefined) {
    cleanUpdates.title = updates.title;
  }
  
  if (updates.description !== undefined) {
    cleanUpdates.description = updates.description;
  }
  
  if (updates.questions !== undefined) {
    cleanUpdates.questions = updates.questions.map(q => {
      const cleanQ: Record<string, unknown> = {
        id: q.id,
        type: q.type,
        question: q.question,
        correctAnswer: q.correctAnswer,
        points: q.points,
        box: q.box,
      };
      
      if (q.options) cleanQ.options = q.options;
      if (q.matchingPairs) cleanQ.matchingPairs = q.matchingPairs;
      if (q.explanation) cleanQ.explanation = q.explanation;
      if (q.lastAnsweredCorrectly !== undefined) {
        cleanQ.lastAnsweredCorrectly = q.lastAnsweredCorrectly;
      }
      
      return cleanQ;
    });
  }
  
  await updateDoc(docRef, cleanUpdates);
}

// Delete a quiz
export async function deleteQuiz(quizId: string): Promise<void> {
  const docRef = doc(db, "quizzes", quizId);
  await deleteDoc(docRef);
}

// Save a quiz attempt
export async function saveQuizAttempt(
  quizId: string,
  userId: string,
  answers: Record<string, string>,
  score: number,
  totalPoints: number,
  matchingAnswers?: Record<string, Record<string, string>>
): Promise<QuizAttempt> {
  const attemptData: Record<string, unknown> = {
    quizId,
    userId,
    answers,
    score,
    totalPoints,
    completedAt: Timestamp.now(),
  };
  
  if (matchingAnswers) {
    attemptData.matchingAnswers = matchingAnswers;
  }

  const docRef = await addDoc(attemptsCollection, attemptData);

  return {
    id: docRef.id,
    quizId,
    userId,
    answers,
    matchingAnswers,
    score,
    totalPoints,
    completedAt: new Date(),
  };
}

// Get user's quiz attempts
export async function getUserAttempts(
  userId: string,
  quizId?: string
): Promise<QuizAttempt[]> {
  let q;

  if (quizId) {
    q = query(
      attemptsCollection,
      where("userId", "==", userId),
      where("quizId", "==", quizId),
      orderBy("completedAt", "desc")
    );
  } else {
    q = query(
      attemptsCollection,
      where("userId", "==", userId),
      orderBy("completedAt", "desc")
    );
  }

  const snapshot = await getDocs(q);
  const attempts: QuizAttempt[] = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    attempts.push({
      id: doc.id,
      quizId: data.quizId,
      userId: data.userId,
      answers: data.answers,
      matchingAnswers: data.matchingAnswers,
      score: data.score,
      totalPoints: data.totalPoints,
      completedAt: data.completedAt?.toDate() ?? new Date(),
    });
  });

  return attempts;
}