import { convertToModelMessages, createAgentUIStream, createAgentUIStreamResponse, createUIMessageStream, createUIMessageStreamResponse, streamText, UIMessage } from "ai";
import { object, string, z } from "zod"
import { messageSchema, userMessageSchema } from "@/lib/firebase/schema";
import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/lib/firebase/firebaseServer";
import { getChatById, saveChat, saveMessage, updateChatTimestampById, updateChatTitleById } from "@/lib/server/queries";
import { aiAgent, generateTitleFromUserMessage } from "@/app/api/chat/ai";
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
    // selectedChatModel: z.string(),
    // selectedVisibilityType: z.enum(["public", "private"]),
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

    const { id, messages } = requestBody
    const uiMessages = messages as UIMessage[]
    const message = uiMessages.at(-1);



    try {
        const chat = await getChatById({ id })
        let titlePromise: Promise<string | null>;
        // if we did not find a chat, let's create it
        if (!chat.success) {
            if (message?.role == "user") {
                console.log("Creating new chat!!")
                await saveChat({ id, userId: auth.userId, title: "New Chat" })

                titlePromise = generateTitleFromUserMessage({ message })

            }
        }
        console.log("did we make it here")

        await saveMessage(
            {
                chatId: id,
                role: "user",
                parts: message?.parts!,
            })





        const modelMessages = await convertToModelMessages(uiMessages)
        const stream = createUIMessageStream({
            execute: async ({ writer }) => {

                const result = await aiAgent.stream({
                    messages: modelMessages,
                })

                writer.merge(result.toUIMessageStream({ sendReasoning: true }))



                // if (titlePromise) {
                //     const title = await titlePromise;
                //     writer.write({ type: "data-title", data: { title } });
                // }
                if (titlePromise) {
                    const title = await titlePromise
                    if (title) await updateChatTitleById({ id, title })
                    console.log("Title", title)

                    writer.write({ type: "data-title", data: { title }, transient: true })
                }

            },
            onFinish: async ({ messages, responseMessage, finishReason }) => {
                console.dir((responseMessage))
                await saveMessage(
                    {
                        chatId: id,
                        role: responseMessage.role,
                        parts: responseMessage.parts,
                        metadata: responseMessage.metadata || [],
                    })
            }
        })
        return createUIMessageStreamResponse({ stream, })

    } catch (err) {

    }
    return;
    // const stream = createUIMessageStream({
    //     originalMessages: uiMessages,
    //     execute: async({writer: dataStream}) => {

    //     }
    // })


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