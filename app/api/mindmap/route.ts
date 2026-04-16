import { NextRequest, NextResponse } from 'next/server';
import { embedQuery } from '@/lib/rag/embeddings';
import { queryTopK } from '@/lib/rag/pinecone';
import { serverDB } from '@/lib/firebase/firebaseServer';
import { generateText, Output } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

// schema for mindmap nodes
const mindmapSchema = z.object({
    nodes: z.array(
        z.object({
            id: z.string(),
            label: z.string(),
            summary: z.string(),
            children: z.array(
                z.object({
                    id: z.string(),
                    label: z.string(),
                    summary: z.string(),
                })
            ),
        })
    ),
});

export async function POST(req: NextRequest) {
    try {
        const { workspaceId, userId } = await req.json();

        // fetch workspace files from Firestore
        const filesSnap = await serverDB
            .collection("workspaces")
            .doc(workspaceId)
            .collection("files")
            .where("ownerUid", "==", userId)
            .get();

        const docIds = filesSnap.docs.map((d) => d.id);

        if (docIds.length === 0) {
            return NextResponse.json({ root: "Mind Map", nodes: [] });
        }

        // query Pinecone for representative chunks from each file
        const broadVector = await embedQuery(
            "main topics, key concepts, and important ideas"
        );

        const allChunks = await Promise.all(
            docIds.map((docId) =>
                queryTopK({ userId, queryVector: broadVector, topK: 5, docId })
            )
        );
     
        const chunkTexts = allChunks
            .flat()
            .map((m) => m.metadata?.chunkText ?? "")
            .filter(Boolean)
            .slice(0, 30) // cap
            .join("\n---\n");

        if (!chunkTexts) {
            return NextResponse.json({ root: "Mind Map", nodes: [] });
        }

        // Use LLM to extract a structured topic hierarchy
        const { output } = await generateText({
            model: google("gemini-2.5-flash"),
            output: Output.object({ schema: mindmapSchema }),
            prompt: `Analyze the following document excerpts from a study workspace and extract the main topics and sub-topics. 
        Group related ideas into a hierarchical mind map structure with 4-8 main topic nodes, each having 2-4 sub-topic children.
        Each node should have a short label (2-5 words) and a one-sentence summary.
        Give each node a unique id (e.g., "topic1", "topic1-1").
        
        Document excerpts:
        ${chunkTexts}`,
        });

        return NextResponse.json({ root: "Mind Map", nodes: output?.nodes ?? [] });

    } catch (err: any) {
        console.error("Mindmap API error:", err);
        return NextResponse.json(
            { error: err.message?? "Internal error" },
            { status: 500 }
        );
    }
}

