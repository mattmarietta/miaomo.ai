"use server"
import { serverDB } from "@/lib/firebase/firebaseServer";
import { DBChatSchema, DBMessageSchema } from "@/lib/firebase/schema";

export async function saveMessage({ chatId, userId, role, parts, metadata, attachments }: DBMessageSchema) {
  try {
    const messageRef = messagesCollection.doc()
    await messageRef.set({
      id: messageRef.id,
      chatId,
      userId,
      role,
      parts,
      metadata,
      attachments,
      createdAt: new Date(),
    })
    return { success: true, data: { id: messageRef.id } }
  } catch (err) {
    console.error('Error saving message:', err);
    return { success: false, error: 'Failed to save message' };
  }
}

export async function saveChat({ id, userId, title, workspaceId }: Pick<DBChatSchema, "id" | "userId" | "title"> & { workspaceId: string }) {
  try {
    return await getChatsCollection(workspaceId).doc(id).set({
      id,
      userId,
      ownerUid: userId,
      createdAt: new Date(),
      updatedAt: null,
      title,
      workspaceId,
    })
  } catch (err) {
    console.error('Error saving chat:', err);
    return { success: false, error: 'Failed to save chat' };
  }
}
export async function getChatMessages({ chatId }: { chatId: string }) {
  try {
    const messagesQuery = messagesCollection.where("chatId", "==", chatId).orderBy("createdAt", "asc")
    const messagesSnapshot = await messagesQuery.get()
    
    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
    }))

    return { success: true, data: messages }
  } catch (err) {
    console.error('Error getting chat messages:', err);
    return { success: false, error: 'Failed to fetch chat messages' };
  }
}
export async function getChatById({ id, workspaceId }: { id: string, workspaceId: string }) {
  try {
    const chatDoc = await getChatsCollection(workspaceId).doc(id).get()
    if (!chatDoc.exists) return { success: false, error: "Chat not found" }
    return {
      success: true, data: {
        id: chatDoc.id, ...chatDoc.data()
      }
    }

  } catch (err) {
    console.error('Error getting chat:', err);
    return { success: false, error: 'Failed to fetch chat' };
  }

}
export async function updateChatTitleById({ id, title, workspaceId }: { id: string, title: string, workspaceId: string }) {
  try {
    const chatRef = getChatsCollection(workspaceId).doc(id)
    await chatRef.update({ title, updatedAt: new Date() })
    return { sucess: true }

  } catch (err) {
    console.error('Error getting chat:', err);
    return { success: false, error: 'Failed to fetch chat' };
  }

}
export async function updateChatTimestampById({ id, workspaceId }: { id: string, workspaceId: string }) {
  try {
    const chatRef = getChatsCollection(workspaceId).doc(id)
    await chatRef.update({ updatedAt: new Date() })
    return { sucess: true }

  } catch (err) {
    console.error('Error getting chat:', err);
    return { success: false, error: 'Failed to fetch chat' };
  }

}

const workspacesCollection = serverDB.collection("workspaces")

export async function updateWorkspaceTitleById({ id, title }: { id: string, title: string }) {
  try {
    const ref = workspacesCollection.doc(id)
    await ref.update({ title, updatedAt: new Date() })
    return { success: true }
  } catch (err) {
    console.error('Error updating workspace title:', err);
    return { success: false, error: 'Failed to update workspace title' };
  }
}

export async function getWorkspaceById({ id }: { id: string }) {
  try {
    const doc = await workspacesCollection.doc(id).get()
    if (!doc.exists) return { success: false, error: "Workspace not found" }
    return { success: true, data: { id: doc.id, ...doc.data() } }
  } catch (err) {
    console.error('Error getting workspace:', err);
    return { success: false, error: 'Failed to fetch workspace' };
  }
}

export async function deleteChatById({ id, workspaceId }: { id: string, workspaceId: string }) {
  try {
    const batch = serverDB.batch()
    const chatRef = getChatsCollection(workspaceId).doc(id)
    const messagesSnapshot = await messagesCollection.where("chatId", '==', id).get()

    messagesSnapshot.docs.forEach(msg => batch.delete(msg.ref))
    batch.delete(chatRef)

    await batch.commit()
  } catch (err: any) {
    throw new Error("There was an error deleting chat and messages into the DB", err)
  }
}



