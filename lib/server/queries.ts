"use server"
import { serverDB } from "@/lib/firebase/firebaseServer";
import { collection, addDoc, getDocs, Timestamp } from "firebase/firestore";
import { chatSchema, DBChatSchema } from "@/lib/firebase/schema";
import { CarTaxiFrontIcon } from "lucide-react";
import { NextResponse } from "next/server";
export type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: Date;
};

const chatsCollection = serverDB.collection("chats")
const messagesCollection = serverDB.collection("messages")

export async function saveChat({id, userId, title}: Pick<DBChatSchema, "id" | "userId" | "title">){
    try {
        return await chatsCollection.doc(id).set({
            id, 
            userId,
            createdAt: new Date(),
            updatedAt: null,
            title
        })
    } catch(err) {
      console.error('Error saving chat:', err);
      return { success: false, error: 'Failed to save chat' };    }


}
export async function saveMessage({chatId, parts, role, metadata, attachments}: any){
    try {
         await messagesCollection.add({
            chatId,
            role,
            parts,
            metadata: [],
            attachments: [],
            createdAt: new Date(),
            updatedAt: null,
        })
    } catch(err) {
      console.error('Error saving chat:', err);
      return { success: false, error: 'Failed to save chat' };    }


}
export async function getChatById({id}: {id: string}){
    try {
         const chatDoc = await chatsCollection.doc(id).get()
         if(!chatDoc.exists) return {success: false, error: "Chat not found"}
          return {success: true, data: {
            id: chatDoc.id, ...chatDoc.data()
          }}

    } catch(err) {
      console.error('Error getting chat:', err);
      return { success: false, error: 'Failed to fetch chat' };
    }

}
export async function updateChatTitleById({id, title}: {id: string, title: string}){
    try {
         const chatRef = await chatsCollection.doc(id)
         await chatRef.update({title, updatedAt: new Date()})
         return {sucess: true}

    } catch(err) {
      console.error('Error getting chat:', err);
      return { success: false, error: 'Failed to fetch chat' };
    }

}
export async function updateChatTimestampById({id}: {id: string}){
    try {
         const chatRef = await chatsCollection.doc(id)
         await chatRef.update({updatedAt: new Date()})
        return {sucess: true}

    } catch(err) {
      console.error('Error getting chat:', err);
      return { success: false, error: 'Failed to fetch chat' };
    }

}

export async function deleteChatById({id}: DBChatSchema){
  try {
    const batch = serverDB.batch()
    const chatRef = await chatsCollection.doc(id)
    if(!chatRef) {
      throw new Error("The chat does not exist")
    }
    const messagesSnapshot = await messagesCollection.where("id", '==', chatRef.id).get()
    
    // adding all the messages and chat to be deleted together in a single batch
    messagesSnapshot.docs.forEach(msg => batch.delete(msg.ref))
    batch.delete(chatRef)

    await batch.commit()
  } catch(err: any) {
      throw new Error("There was an error deleting chat and messages into the DB", err)
  }


}



