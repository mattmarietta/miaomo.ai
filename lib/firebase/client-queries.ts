import { db } from "@/lib/firebase/firebase";
import { collection, doc, setDoc, deleteDoc, Timestamp, query, where, onSnapshot } from "firebase/firestore";
import { DBChatSchema, DBWorkspaceSchema, DBWorkspaceFileSchema, DBHighlightSchema } from "@/lib/firebase/schema";


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
) {
    const filesCol = collection(db, "workspaces", workspaceId, "files");
    const ref = doc(filesCol);
    await setDoc(ref, {
        id: ref.id,
        originalName: fileData.originalName,
        mimeType: fileData.mimeType,
        size: fileData.size,
        storagePath: fileData.storagePath,
        downloadUrl: fileData.downloadUrl,
        ownerUid: fileData.ownerUid,
        workspaceID: workspaceId,
        status: "uploaded",
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
