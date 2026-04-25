import { convertToModelMessages, createAgentUIStream, createAgentUIStreamResponse, createUIMessageStream, createUIMessageStreamResponse, streamText, UIMessage } from "ai";
import { object, string, z } from "zod"
import { messageSchema, userMessageSchema } from "@/lib/firebase/schema";
import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/lib/firebase/firebaseServer";
import { getChatById, getWorkspaceById, getWorkspaceFiles, saveChat, saveMessage, updateChatTimestampById, updateChatTitleById, updateWorkspaceTitleById } from "@/lib/firebase/server-queries";
import { aiAgent, generateTitleFromUserMessage, setAgentUserId, setAgentWorkspaceId, setAgentFiles } from "@/app/api/chat/ai";
import { createVertex } from "@ai-sdk/google-vertex/edge";
import { createGoogleGenerativeAI } from "@ai-sdk/google"
// Allow streaming responses up to 30 seconds
export const maxDuration = 30;


export const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_AI_STUDIO_API_KEY!
})



export const postRequestBodySchema = z.object({
    id: z.string(),
    // Either a single new message or all messages (for tool approvals)
    message: userMessageSchema.optional(),
    messages: z.array(messageSchema).optional(),
    workspaceId: z.string(),
});

type PostRequestBody = z.infer<typeof postRequestBodySchema>;


export async function POST(req: Request) {

    const auth = await getAuth(req);
    if (!auth.success || !auth.userId) {
        console.error("User is not authorized")
        return NextResponse.json("User is not authorized")
    }
    // const { messages }: { messages: UIMessage[] } = await req.json();
    let requestBody: PostRequestBody;
    // Try to parse the post request body
    try {
        const json = await req.json()
        console.dir(json)
        requestBody = postRequestBodySchema.parse(json)
    } catch (err) {
        console.error(err)
        throw new Error("There was an error parsing the post body request")
    }

    const { id, messages, workspaceId } = requestBody
    console.log("Chat request - id:", id, "workspaceId:", workspaceId)
    const uiMessages = messages as UIMessage[]
    const message = uiMessages.at(-1);



    try {
        const chat = await getChatById({ id, workspaceId })
        let titlePromise: Promise<string | null>;
        // if we did not find a chat, let's create it
        if (!chat.success) {
            if (message?.role == "user") {
                console.log("Creating new chat!!")
                await saveChat({ id, userId: auth.userId, title: "New Chat", workspaceId })

                titlePromise = generateTitleFromUserMessage({ message })

                // Auto-title the workspace if it's still "Untitled Workspace"
                if (workspaceId) {
                    const ws = await getWorkspaceById({ id: workspaceId })
                    if (ws.success && (ws.data as any)?.title === "Untitled Workspace") {
                        titlePromise.then(async (title) => {
                            if (title) {
                                await updateWorkspaceTitleById({ id: workspaceId, title })
                            }
                        }).catch(console.error)
                    }
                }
            }
        }
        console.log("did we make it here")

        await saveMessage(
            {
                chatId: id,
                userId: auth.userId,
                role: "user",
                parts: message?.parts!,
            })





        const modelMessages = await convertToModelMessages(uiMessages)
        const stream = createUIMessageStream({
            execute: async ({ writer }) => {

                setAgentUserId(auth.userId);
                setAgentWorkspaceId(workspaceId);
                const files = await getWorkspaceFiles({ workspaceId });
                setAgentFiles(files);
                const result = await aiAgent.stream({
                    messages: modelMessages,
                })

                writer.merge(result.toUIMessageStream({ sendReasoning: true }))

                if (titlePromise) {
                    const title = await titlePromise
                    if (title) await updateChatTitleById({ id, title, workspaceId })
                    console.log("Title", title)

                    writer.write({ type: "data-title", data: { title }, transient: true })
                }

            },
            onFinish: async ({ messages, responseMessage, finishReason }) => {
                console.dir((responseMessage))
                await saveMessage(
                    {
                        userId: auth.userId,
                        chatId: id,
                        role: responseMessage.role,
                        parts: responseMessage.parts,
                        metadata: responseMessage.metadata || [],
                    })
            }
        })
        return createUIMessageStreamResponse({ stream, })

    } catch (err) {
        console.error("Chat route error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Internal server error" },
            { status: 500 },
        );
    }


}


const getAuth = async (request: Request) => {
    const authHeader = request.headers.get("Authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return ({ success: false, error: "Missing or invalid Authorization header" })
    }

    try {

        const token = authHeader.split("Bearer ")[1]
        const decodedToken = await serverAuth.verifyIdToken(token)
        return { success: true, userId: decodedToken.uid };

    } catch (err) {
        return { success: false, error: "Invalid token" };

    }
}