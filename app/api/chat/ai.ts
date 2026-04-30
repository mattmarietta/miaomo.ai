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

const googleSearchTool = google.tools.googleSearch({});

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

let _webSearchMode = false;

export function setWebSearchMode(enabled: boolean) {
  _webSearchMode = enabled;
}

function buildInstructions(): string {
  const fileList = _currentFiles.length > 0
    ? _currentFiles.map((f) => `- "${f.originalName}"`).join("\n")
    : "(no files uploaded yet)";

  const webSearchInstructions = _webSearchMode
    ? `\n\nThe user has enabled web search mode. Use the webSearch tool to find information from the internet. You can combine web search with document search when relevant.`
    : `\n\nYou also have a webSearch tool. Use it when: (1) the user explicitly asks to search the web, (2) the question is about current events or recent information not in their documents, or (3) document search returns no relevant results and the topic is general knowledge.`;

  return `You are a helpful study assistant. The user has the following files in their workspace:
${fileList}

IMPORTANT: You MUST use the searchDocuments tool to search the user's documents before answering ANY question that could be related to their study material or uploaded files. Always search first, then answer based on the results. If the user asks about a specific file, mention which file you're searching. If no relevant results are found, let the user know and offer to help differently.

When citing information from search results, ALWAYS include the source file name at the end of your answer in a "Sources" section. Format each source as: **[filename]** (page N, chunk #N). Use the "source", "page", and "chunkIndex" fields from the results. Only cite sources that you actually used in your answer.${webSearchInstructions}

You can also create quizzes and flashcard decks using the createQuiz and createFlashcards tools. Use these when the user asks to test their knowledge, create practice questions, make study materials, or generate flashcards. Always search the documents first to gather content, then pass that content to the quiz/flashcard tool.`;
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
              page: r.page,
            })),
          };
        } catch (err) {
          console.error("searchDocuments error:", err);
          return { results: [], message: "Error searching documents." };
        }
      },
    }),
    createQuiz: tool({
      description:
        "Create a quiz from the conversation context or document content. Use when the user asks to create a quiz, test their knowledge, or generate practice questions. Returns quiz data that the user can click to start.",
      parameters: z.object({
        title: z.string().describe("A short title for the quiz"),
        content: z.string().describe("The study material or topic to generate questions from. Include as much relevant content as possible from the conversation or document search results."),
        questionCount: z.number().optional().describe("Number of questions (default 5)"),
        questionTypes: z.array(z.string()).optional().describe("Types: multiple-choice, true-false, written, matching"),
      }),
      // @ts-expect-error — ai v6 tool() generic inference issue with ToolLoopAgent
      execute: async (args: Record<string, unknown>) => {
        const title = (args as any).title || "Quiz";
        const content = (args as any).content;
        const count = (args as any).questionCount ?? 5;
        const types = (args as any).questionTypes ?? ["multiple-choice", "true-false"];
        if (!content || typeof content !== "string") {
          return { success: false, message: "No content provided to generate quiz from." };
        }
        try {
          const typeInstructions = (types as string[]).map((t: string) => {
            switch (t) {
              case "multiple-choice": return "- Multiple choice: exactly 4 options, one correct answer";
              case "true-false": return "- True/false: statement that is either true or false, correctAnswer must be 'true' or 'false'";
              case "written": return "- Written: short answer question (answer should be 1-3 words)";
              case "matching": return "- Matching: 4 term-definition pairs to match";
              default: return "";
            }
          }).filter(Boolean).join("\n");

          const { text } = await generateText({
            model: google("gemini-2.0-flash"),
            prompt: `Create exactly ${count} quiz questions from this study material.
Use ONLY these question types: ${(types as string[]).join(", ")}

Rules for each type:
${typeInstructions}

Study material:
"""
${(content as string).substring(0, 15000)}
"""

Return ONLY a valid JSON array. Each question format:
For multiple-choice: {"type":"multiple-choice","question":"...","options":["A","B","C","D"],"correctAnswer":"A","explanation":"..."}
For true-false: {"type":"true-false","question":"...","correctAnswer":"true","explanation":"..."}
For written: {"type":"written","question":"...","correctAnswer":"...","explanation":"..."}
For matching: {"type":"matching","question":"Match the following","matchingPairs":[{"term":"...","definition":"..."}]}

Return ONLY the JSON array.`,
          });

          let jsonStr = text;
          const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) jsonStr = codeBlockMatch[1];
          jsonStr = jsonStr.trim();
          if (!jsonStr.startsWith("[")) {
            const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
            if (arrayMatch) jsonStr = arrayMatch[0];
          }

          const questions = JSON.parse(jsonStr);
          return {
            success: true,
            type: "quiz",
            title,
            description: `Generated ${questions.length} questions`,
            questions,
            questionCount: questions.length,
          };
        } catch (err) {
          console.error("createQuiz error:", err);
          return { success: false, message: "Error generating quiz questions." };
        }
      },
    }),
    createFlashcards: tool({
      description:
        "Create a flashcard deck from the conversation context or document content. Use when the user asks for flashcards, study cards, or wants to review key terms and definitions.",
      parameters: z.object({
        title: z.string().describe("A short title for the flashcard deck"),
        content: z.string().describe("The study material or topic to generate flashcards from. Include as much relevant content as possible."),
        cardCount: z.number().optional().describe("Number of flashcards (default 10)"),
      }),
      // @ts-expect-error — ai v6 tool() generic inference issue with ToolLoopAgent
      execute: async (args: Record<string, unknown>) => {
        const title = (args as any).title || "Flashcard Deck";
        const content = (args as any).content;
        const count = (args as any).cardCount ?? 10;
        if (!content || typeof content !== "string") {
          return { success: false, message: "No content provided to generate flashcards from." };
        }
        try {
          const { text } = await generateText({
            model: google("gemini-2.0-flash"),
            prompt: `Extract ${count} key terms and definitions from this text. Return as JSON array.

Text:
"""
${(content as string).substring(0, 15000)}
"""

Return ONLY a JSON array like this, no other text:
[
  {"front": "Term or question", "back": "Definition or answer"},
  {"front": "Another term", "back": "Another definition"}
]`,
          });

          let jsonStr = text;
          const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) jsonStr = codeBlockMatch[1];
          jsonStr = jsonStr.trim();
          if (!jsonStr.startsWith("[")) {
            const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
            if (arrayMatch) jsonStr = arrayMatch[0];
          }

          const cards = JSON.parse(jsonStr);
          return {
            success: true,
            type: "flashcards",
            title,
            description: `Generated ${cards.length} flashcards`,
            cards,
            cardCount: cards.length,
          };
        } catch (err) {
          console.error("createFlashcards error:", err);
          return { success: false, message: "Error generating flashcards." };
        }
      },
    }),
    webSearch: tool({
      description:
        "Search the web for current information, news, or topics not covered in the user's documents. Use when the question is about recent events, general knowledge, or when the user explicitly asks to search the web.",
      parameters: z.object({
        query: z.string().describe("The web search query"),
      }),
      // @ts-expect-error — ai v6 tool() generic inference issue with ToolLoopAgent
      execute: async (args: Record<string, unknown>) => {
        const raw = (args as any).query ?? (args as any).queries;
        const query: string | undefined = Array.isArray(raw) ? raw[0] : raw;
        if (!query || typeof query !== "string") {
          return { results: [], message: "Missing or invalid search query." };
        }
        try {
          const { text } = await generateText({
            model: google("gemini-2.0-flash"),
            tools: { google_search: googleSearchTool as any },
            prompt: query,
          });
          return {
            query,
            answer: text,
          };
        } catch (err) {
          console.error("webSearch error:", err);
          return { results: [], message: "Error performing web search." };
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
