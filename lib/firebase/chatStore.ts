import { db } from "@/lib/firebase/firebase";
import { collection, addDoc, getDocs, Timestamp, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { chatSchema, DBChatSchema } from "@/lib/firebase/schema";
import { CarTaxiFrontIcon } from "lucide-react";
export type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: Date;
};

const chatsCollection = collection(db, "chats");
const messagesCollection = collection(db, "messages");

export async function saveChat({ id, userId, createdAt, updatedAt, title }: DBChatSchema) {
    try {
        const ref = await addDoc(chatsCollection, {
            id,
            userId,
            createdAt,
            updatedAt,
            title
        })
    } catch (err) {
        throw new Error("There was an error saving the chat into the DB")
    }


}


// CREATE
export async function createChatMessage(role: "user" | "assistant", content: string): Promise<ChatMessage> {
    const ref = await addDoc(messagesCollection, {
        role,
        content,
        createdAt: Timestamp.now(),
    });
    return { id: ref.id, role, content, createdAt: new Date() };
}

// READ (all)
export async function fetchChatMessages(): Promise<ChatMessage[]> {
    const snap = await getDocs(messagesCollection);
    return snap.docs.map((doc) => {
        const data = doc.data() as ChatMessage
        return {
            ...data,
            id: doc.id,
            role: data.role,
            content: data.content,
            createdAt: data.createdAt
        };
    });
}
export async function fetchChatMessagesById(id: string, userId: string): Promise<ChatMessage[]> {
    const q = query(
        messagesCollection,
        where("chatId", "==", id),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
    )
    const snap = await getDocs(q);
    return snap.docs.map((doc) => {
        const data = doc.data() as ChatMessage
        return {
            ...data,
            id: doc.id,
            role: data.role,
            content: data.content,
            createdAt: data.createdAt
        };
    });
}
export async function fetchChatsByUserId(userId: string): Promise<DBChatSchema[]> {
    const q = query(
        chatsCollection,
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
    )
    const snap = await getDocs(q);
    return snap.docs.map((doc) => {
        return doc.data() as DBChatSchema

    });
}
/** Subscribe to real-time chat list updates for a user. Returns an unsubscribe function. */
export function subscribeChatsByUserId(
    userId: string,
    onChats: (chats: DBChatSchema[]) => void,
    onError?: (error: Error) => void,
) {
    const q = query(
        chatsCollection,
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
    );
    return onSnapshot(
        q,
        (snap) => {
            const chats = snap.docs.map((doc) => doc.data() as DBChatSchema);
            onChats(chats);
        },
        (err) => onError?.(err),
    );
}
