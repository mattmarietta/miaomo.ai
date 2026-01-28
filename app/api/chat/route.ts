import { convertToModelMessages, streamText, UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const result = streamText({
        model: anthropic("claude-opus-4-5"),
        system: "You are a helpful assistant for answering questions related to user uploaded documents.",
        messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
}
