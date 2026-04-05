import { generateText, InferAgentUIMessage, UIMessage } from "ai";

import { tool, ToolLoopAgent } from "ai";
import { z } from "zod";

import { retrieveContext } from "@/lib/rag/retrieve";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_STUDIO_API_KEY!,
});

// Mutable refs — set before each agent call
let _currentUserId: string | undefined;
let _currentWorkspaceId: string | undefined;
let _currentFiles: { id: string; originalName: string }[] = [];

export function setAgentUserId(userId: string | undefined) {
  _currentUserId = userId;
}

export function setAgentWorkspaceId(workspaceId: string | undefined) {
  _currentWorkspaceId = workspaceId;
}

export function setAgentFiles(files: { id: string; originalName: string }[]) {
  _currentFiles = files;
}

function buildInstructions(): string {
  const fileList = _currentFiles.length > 0
    ? _currentFiles.map((f) => `- "${f.originalName}"`).join("\n")
    : "(no files uploaded yet)";

  return `You are a helpful study assistant. The user has the following files in their workspace:
${fileList}

IMPORTANT: You MUST use the searchDocuments tool to search the user's documents before answering ANY question that could be related to their study material or uploaded files. Always search first, then answer based on the results. If the user asks about a specific file, mention which file you're searching. If no relevant results are found, let the user know and offer to help differently.

When citing information from search results, ALWAYS include the source file name at the end of your answer in a "Sources" section. Format each source as: **[filename]** (chunk #N). Use the "source" and "chunkIndex" fields from the results. Only cite sources that you actually used in your answer.`;
}

export const aiAgent = new ToolLoopAgent({
  model: google("gemini-flash-latest"),
  get instructions() { return buildInstructions(); },
  tools: {
    searchDocuments: tool({
      description:
        "Search the user's uploaded documents for relevant content. Use this when the user asks about their files, study material, or any topic that might be covered in their documents.",
      parameters: z.object({
        query: z
          .string()
          .describe(
            "The search query — describe what you're looking for in natural language",
          ),
      }),
      // @ts-expect-error — ai v6 tool() generic inference issue with ToolLoopAgent
      execute: async (args: Record<string, unknown>) => {
        // Gemini sometimes sends { queries: ["..."] } instead of { query: "..." }
        const raw = (args as any).query ?? (args as any).queries;
        const query: string | undefined = Array.isArray(raw) ? raw[0] : raw;
        if (!query || typeof query !== "string") {
          return {
            results: [],
            message: "Missing or invalid search query.",
          };
        }
        if (!_currentWorkspaceId) {
          return {
            results: [],
            message: "No workspace context — unable to search documents.",
          };
        }
        try {
          const results = await retrieveContext({
            workspaceId: _currentWorkspaceId,
            query,
            topK: 6,
          });
          if (results.length === 0) {
            return {
              results: [],
              message: "No matching content found in your documents.",
            };
          }
          return {
            results: results.map((r) => ({
              text: r.text,
              source: r.source,
              fileName: r.source?.split("/").pop() ?? "unknown",
              score: r.score,
              fileId: r.fileId,
              chunkIndex: r.chunkIndex,
            })),
          };
        } catch (err) {
          console.error("searchDocuments error:", err);
          return { results: [], message: "Error searching documents." };
        }
      },
    }),
  },
});

export type ChatAgent = InferAgentUIMessage<typeof aiAgent>;
export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  "use server";
  try {
    const { text } = await generateText({
      model: google("gemini-flash-latest"),
      system: `
      - you will generate a short title based on the first message a user begins a conversation with
      - ensure it is not more than 70 characters long
      - the title should be a summary of the user's message, do not simply restate it
      - Do not use outside/internal information
      - do not use quotes or colons`,
      prompt: JSON.stringify(message),
      maxOutputTokens: 500,
    });

    console.log("TEXTTTT", text);

    return text;
  } catch (err) {
    console.error("Title generation failed: ", err);
    return null;
  }
}
