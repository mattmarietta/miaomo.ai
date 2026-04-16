import { db } from "@/lib/firebase/firebase";
import { collection, doc, setDoc, deleteDoc, getDocs, Timestamp, query, where, onSnapshot } from "firebase/firestore";
import { DBChatSchema, DBWorkspaceSchema, DBWorkspaceFileSchema } from "@/lib/firebase/schema";


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

// Delete a workspace and all its files/chats from Firestore
// TODO: also delete the actual files from Firebase Storage
export async function deleteWorkspace(workspaceId: string, userId: string) {
    // Get all files owned by this user in the workspace
    const filesRef = collection(db, "workspaces", workspaceId, "files");
    const filesQuery = query(filesRef, where("ownerUid", "==", userId));
    const files = await getDocs(filesQuery);
    for (const file of files.docs) {
        await deleteDoc(file.ref);
    }

    // Get all chats owned by this user in the workspace
    const chatsRef = collection(db, "workspaces", workspaceId, "chats");
    const chatsQuery = query(chatsRef, where("ownerUid", "==", userId));
    const chats = await getDocs(chatsQuery);
    for (const chat of chats.docs) {
        await deleteDoc(chat.ref);
    }

    // Finally, delete the workspace itself
    await deleteDoc(doc(db, "workspaces", workspaceId));
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
