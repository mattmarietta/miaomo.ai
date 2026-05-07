import { db, storage } from "@/lib/firebase/firebase";
import { collection, doc, setDoc, deleteDoc, Timestamp, query, where, onSnapshot, orderBy, getDocs } from "firebase/firestore";
import { deleteObject, ref as storageRef } from "firebase/storage";
import { DBChatSchema, DBMessageSchema, DBWorkspaceSchema, DBWorkspaceFileSchema, DBHighlightSchema } from "@/lib/firebase/schema";


// ── Workspaces ──

const workspacesCollection = collection(db, "workspaces");

export async function createWorkspace(userId: string, title: string): Promise<string> {
    const ref = doc(workspacesCollection);
    await setDoc(ref, {
        id: ref.id,
        title,
        ownerUid: userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return ref.id;
}

export function subscribeWorkspacesByUserId(
    userId: string,
    onWorkspaces: (workspaces: DBWorkspaceSchema[]) => void,
    onError?: (error: Error) => void,
) {
    const q = query(
        workspacesCollection,
        where("ownerUid", "==", userId),
    );
    return onSnapshot(
        q,
        (snap) => {
            const workspaces = snap.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
            } as DBWorkspaceSchema));
            // Sort client-side to avoid needing a composite index
            workspaces.sort((a, b) => {
                const aTime = a.updatedAt?.toMillis?.() ?? 0;
                const bTime = b.updatedAt?.toMillis?.() ?? 0;
                return bTime - aTime;
            });
            onWorkspaces(workspaces);
        },
        (err) => {
            console.error("subscribeWorkspacesByUserId error:", err);
            onError?.(err);
        },
    );
}

export function generateWorkspaceFileId(workspaceId: string): string {
    const filesCol = collection(db, "workspaces", workspaceId, "files");
    return doc(filesCol).id;
}

export async function addWorkspaceFile(
    workspaceId: string,
    fileData: {
        originalName: string;
        mimeType: string;
        size: number;
        storagePath: string;
        downloadUrl: string;
        ownerUid: string;
    },
    fileId?: string,
) {
    const filesCol = collection(db, "workspaces", workspaceId, "files");
    const ref = fileId ? doc(filesCol, fileId) : doc(filesCol);
    await setDoc(ref, {
        id: ref.id,
        originalName: fileData.originalName,
        mimeType: fileData.mimeType,
        size: fileData.size,
        storagePath: fileData.storagePath,
        downloadUrl: fileData.downloadUrl,
        ownerUid: fileData.ownerUid,
        workspaceId: workspaceId,
        status: "pending",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return ref.id;
}

export function subscribeWorkspaceFiles(
    workspaceId: string,
    userId: string,
    onFiles: (files: DBWorkspaceFileSchema[]) => void,
    onError?: (error: Error) => void,
) {
    const filesCol = collection(db, "workspaces", workspaceId, "files");
    return onSnapshot(
        query(filesCol, where("ownerUid", "==", userId)),
        (snap) => {
            const files = snap.docs.map((d) => ({
                ...d.data(),
                id: d.id,
            } as DBWorkspaceFileSchema));
            files.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() ?? 0;
                const bTime = b.createdAt?.toMillis?.() ?? 0;
                return bTime - aTime;
            });
            onFiles(files);
        },
        (err) => {
            console.error("subscribeWorkspaceFiles error:", err);
            onError?.(err);
        },
    );
}

export async function updateWorkspaceFileStatus(
    workspaceId: string,
    fileId: string,
    status: string,
    additionalData?: Partial<DBWorkspaceFileSchema>
) {
    const fileDoc = doc(db, "workspaces", workspaceId, "files", fileId);
    await setDoc(fileDoc, {
        status,
        updatedAt: Timestamp.now(),
        ...additionalData,
    }, { merge: true });
}

// ── Highlights ──

export async function addHighlight(
    workspaceId: string,
    fileId: string,
    highlight: Omit<DBHighlightSchema, "createdAt">,
) {
    const highlightsCol = collection(db, "workspaces", workspaceId, "files", fileId, "highlights");
    const ref = doc(highlightsCol, highlight.id);
    console.debug("[highlights] addHighlight", {
        workspaceId,
        fileId,
        userId: highlight.userId,
        highlightId: highlight.id,
    });
    await setDoc(ref, {
        ...highlight,
        fileId,
        createdAt: Timestamp.now(),
    });
    return ref.id;
}

export async function deleteHighlight(
    workspaceId: string,
    fileId: string,
    highlightId: string,
) {
    const ref = doc(db, "workspaces", workspaceId, "files", fileId, "highlights", highlightId);
    await deleteDoc(ref);
}

export function subscribeHighlights(
    workspaceId: string,
    fileId: string,
    userId: string,
    onHighlights: (highlights: DBHighlightSchema[]) => void,
    onError?: (error: Error) => void,
) {
    const highlightsCol = collection(db, "workspaces", workspaceId, "files", fileId, "highlights");
    const q = query(highlightsCol, where("userId", "==", userId));
    console.debug("[highlights] subscribeHighlights:start", { workspaceId, fileId, userId });
    return onSnapshot(
        q,
        (snap) => {
            const highlights = snap.docs.map((d) => ({
                ...d.data(),
                id: d.id,
            } as DBHighlightSchema));
            highlights.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() ?? 0;
                const bTime = b.createdAt?.toMillis?.() ?? 0;
                return bTime - aTime;
            });
            console.debug("[highlights] subscribeHighlights:update", {
                workspaceId,
                fileId,
                userId,
                count: highlights.length,
            });
            onHighlights(highlights);
        },
        (err) => {
            console.error("subscribeHighlights error:", err);
            onError?.(err);
        },
    );
}

// ── Chats ──

export function subscribeWorkspaceChats(
    workspaceId: string,
    userId: string,
    onChats: (chats: DBChatSchema[]) => void,
    onError?: (error: Error) => void,
) {
    const chatsCol = collection(db, "workspaces", workspaceId, "chats");
    const q = query(
        chatsCol,
        where("ownerUid", "==", userId),
    );
    return onSnapshot(
        q,
        (snap) => {
            const chats = snap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as DBChatSchema));
            chats.sort((a, b) => {
                const aTime = (a.createdAt as any)?.toMillis?.() ?? 0;
                const bTime = (b.createdAt as any)?.toMillis?.() ?? 0;
                return bTime - aTime;
            });
            onChats(chats);
        },
        (err) => {
            console.error("subscribeWorkspaceChats error:", err);
            onError?.(err);
        },
    );
}

export function subscribeChatsByUserId(
    userId: string,
    onChats: (chats: DBChatSchema[]) => void,
    onError?: (error: Error) => void,
) {
    const chatsCol = collection(db, "chats");
    const q = query(chatsCol, where("userId", "==", userId));
    return onSnapshot(
        q,
        (snap) => {
            const chats = snap.docs.map((d) => ({ ...d.data(), id: d.id } as DBChatSchema));
            chats.sort((a, b) => {
                const aTime = (a.createdAt as any)?.toMillis?.() ?? 0;
                const bTime = (b.createdAt as any)?.toMillis?.() ?? 0;
                return bTime - aTime;
            });
            onChats(chats);
        },
        (err) => {
            console.error("subscribeChatsByUserId error:", err);
            onError?.(err);
        },
    );
}

// ── Messages ──

const messagesCollection = collection(db, "messages");

export async function getMessagesByChatId(chatId: string) {
    const q = query(
        messagesCollection,
        where("chatId", "==", chatId),
        orderBy("createdAt", "asc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DBMessageSchema & { id: string }));
}

// ── File deletion ──
// Deletes from Storage (triggers Cloud Function → Pinecone cleanup for PDFs)
// and removes the Firestore doc directly (covers non-PDF files and acts as backup).
export async function deleteWorkspaceFile(
    workspaceId: string,
    fileId: string,
    storagePath: string,
): Promise<void> {
    try {
        await deleteObject(storageRef(storage, storagePath));
    } catch (err) {
        console.error("[deleteWorkspaceFile] Storage delete error (continuing):", err);
    }
    await deleteDoc(doc(db, "workspaces", workspaceId, "files", fileId));
}

// ── Workspace deletion ──
// Deletes all files from Storage (triggers Cloud Function for Pinecone cleanup),
// removes all file Firestore docs, then removes the workspace document itself.
export async function deleteWorkspace(
    workspaceId: string,
    userId: string,
): Promise<void> {
    const filesCol = collection(db, "workspaces", workspaceId, "files");
    const filesSnap = await getDocs(query(filesCol, where("ownerUid", "==", userId)));

    await Promise.all(
        filesSnap.docs.map(async (fileDocSnap) => {
            const fileData = fileDocSnap.data() as DBWorkspaceFileSchema;
            if (fileData.storagePath) {
                try {
                    await deleteObject(storageRef(storage, fileData.storagePath));
                } catch (err) {
                    console.error("[deleteWorkspace] Storage delete error (continuing):", err);
                }
            }
            await deleteDoc(fileDocSnap.ref);
        }),
    );

    await deleteDoc(doc(workspacesCollection, workspaceId));
}

// ── Study Tools ──

export interface QuizSummary {
    id: string;
    title: string;
    questionCount: number;
    createdAt: any;
}

export interface FlashcardDeckSummary {
    id: string;
    title: string;
    cardCount: number;
    createdAt: any;
}

export function subscribeQuizzesByUserId(
    userId: string,
    onQuizzes: (quizzes: QuizSummary[]) => void,
    onError?: (error: Error) => void,
) {
    const q = query(
        collection(db, "quizzes"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
        onQuizzes(snap.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                title: data.title || "Untitled Quiz",
                questionCount: Array.isArray(data.questions) ? data.questions.length : 0,
                createdAt: data.createdAt,
            };
        }));
    }, (err) => onError?.(err));
}

export function subscribeFlashcardDecksByUserId(
    userId: string,
    onDecks: (decks: FlashcardDeckSummary[]) => void,
    onError?: (error: Error) => void,
) {
    const q = query(
        collection(db, "flashcardDecks"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
        onDecks(snap.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                title: data.title || "Untitled Deck",
                cardCount: Array.isArray(data.cards) ? data.cards.length : 0,
                createdAt: data.createdAt,
            };
        }));
    }, (err) => onError?.(err));
}
