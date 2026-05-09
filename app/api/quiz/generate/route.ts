import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/lib/firebase/firebaseServer";
import { generateQuestionsFromText } from "@/lib/aiQuizGenerator";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await serverAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { text, count, types } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  try {
    const questions = await generateQuestionsFromText(text, count ?? 10, types ?? ["multiple-choice", "true-false"]);
    return NextResponse.json({ questions });
  } catch (err) {
    console.error("Quiz generation error:", err);
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
  }
}
