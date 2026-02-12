import { NextRequest, NextResponse } from "next/server";
import { ragChain } from "@/lib/rag/rag";

export async function POST(request: NextRequest) {
  try {
    const { question, docId } = await request.json();
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 401 });
    }

    const result = await ragChain({ question, userId, docId });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}