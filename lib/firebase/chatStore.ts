import { db } from "@/lib/firebase/firebase";
import { collection, addDoc, getDocs, Timestamp } from "firebase/firestore";

export type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: Date;
};

const chatCollection = collection(db, "chatMessages");

// CREATE
export async function createChatMessage(role: "user" | "assistant", content: string): Promise<ChatMessage> {
    const ref = await addDoc(chatCollection, {
        role,
        content,
        createdAt: Timestamp.now(),
    });
    return { id: ref.id, role, content, createdAt: new Date() };
}

// READ (all)
export async function fetchChatMessages(): Promise<ChatMessage[]> {
    const snap = await getDocs(chatCollection);
    return snap.docs.map((doc) => {
        const data = doc.data() as {
            role: "user" | "assistant";
            content: string;
            createdAt?: Timestamp;
        };
        return {
            id: doc.id,
            role: data.role,
            content: data.content,
            createdAt: data.createdAt?.toDate() ?? new Date(),
        };
    });
}
