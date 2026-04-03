"use server"
import { serverDB } from "@/lib/firebase/firebaseServer";
import { DBChatSchema, DBMessageSchema } from "@/lib/firebase/schema";

const messagesCollection = serverDB.collection("messages")

function getChatsCollection(workspaceId: string) {
  return serverDB.collection("workspaces").doc(workspaceId).collection("chats")
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
export async function saveMessage({ chatId, parts, role, userId, metadata, attachments }: DBMessageSchema) {
  try {
    const result = await messagesCollection.add({
      chatId,
      userId,
      role,
      parts,
      metadata: [],
      attachments: [],
      createdAt: new Date(),
    })
    console.log(result)
  } catch (err) {
    console.error('Error saving chat:', err);
    return { success: false, error: 'Failed to save chat' };
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



