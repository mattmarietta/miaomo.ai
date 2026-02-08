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

export type QuestionType = "multiple-choice" | "true-false" | "written" | "matching";

export type Option = {
  id: string;
  text: string;
};

export type MatchingPair = {
  id: string;
  term: string;
  definition: string;
};

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

export type Quiz = {
  id: string;
  userId: string;
  title: string;
  description: string;
  questions: Question[];
  createdAt: Date;
  updatedAt: Date;
};

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

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

const quizzesCollection = collection(db, "quizzes");
const attemptsCollection = collection(db, "quizAttempts");

export async function createQuiz(
  userId: string,
  title: string,
  description: string
): Promise<Quiz> {
  const now = Timestamp.now();

  const docRef = await addDoc(quizzesCollection, {
    userId: userId,
    title: title,
    description: description,
    questions: [],
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: docRef.id,
    userId: userId,
    title: title,
    description: description,
    questions: [],
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
  };
}

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
  };
}

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
    });
  });

  return quizzes;
}

export async function updateQuiz(
  quizId: string,
  updates: {
    title?: string;
    description?: string;
    questions?: Question[];
  }
): Promise<void> {
  const docRef = doc(db, "quizzes", quizId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteQuiz(quizId: string): Promise<void> {
  const docRef = doc(db, "quizzes", quizId);
  await deleteDoc(docRef);
}

export async function saveQuizAttempt(
  quizId: string,
  userId: string,
  answers: Record<string, string>,
  score: number,
  totalPoints: number,
  matchingAnswers?: Record<string, Record<string, string>>
): Promise<QuizAttempt> {
  const docRef = await addDoc(attemptsCollection, {
    quizId,
    userId,
    answers,
    matchingAnswers,
    score,
    totalPoints,
    completedAt: Timestamp.now(),
  });

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