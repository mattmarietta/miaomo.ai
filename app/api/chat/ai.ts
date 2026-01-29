
import { google } from "@ai-sdk/google"

import { generateText, InferAgentUIMessage, UIMessage } from "ai"

import { ToolLoopAgent, stepCountIs, tool} from "ai";
import {z} from "zod"

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
      - the title should be a summary of the user's message
      - Do not use outside/internal information
      - do not use quotes or colons`,
      prompt: JSON.stringify(message),
      maxOutputTokens: 100
    })
    
    return text
  } catch(err) {
    console.error("Title generation failed: ", err)
    return null
  }
}