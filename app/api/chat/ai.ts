

import { createVertex } from "@ai-sdk/google-vertex"

import { generateText, InferAgentUIMessage, UIMessage } from "ai"

import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { env } from "process";
import { z } from "zod"

import { createGoogleGenerativeAI } from "@ai-sdk/google"
// Allow streaming responses up to 30 seconds
export const maxDuration = 30;


export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_STUDIO_API_KEY!
})



export const aiAgent = new ToolLoopAgent({
  model: google("gemini-flash-latest"),
  // toolChoice: "auto",
  instructions: "You are a helpful assistant for answering questions related to user uploaded documents",
  // maxOutputTokens: 10000,
  // callOptionsSchema: z.object({
  // instruction: z.string(),
  // textVerbosity: z.enum(["medium", "low"]),
  // reasoningEffort: z.enum(["none", "low"])
  // }),
  // prepareCall: ({options, ...settings}) => ({
  //   ...settings,
  //   instructions: options.instruction,
  // }) 

})

export type ChatAgent = InferAgentUIMessage<typeof aiAgent>
export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage
}) {
  "use server"
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
      maxOutputTokens: 500
    })

    console.log("TEXTTTT", text)

    return text
  } catch (err) {
    console.error("Title generation failed: ", err)
    return null
  }
}