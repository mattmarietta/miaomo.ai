import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/lib/firebase/firebaseServer";
import { getMessagesByChatId } from "@/lib/firebase/server-queries";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ error: "chatId is required" }, { status: 400 });
  }

  // Verify auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = authHeader.split("Bearer ")[1];
    await serverAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const result = await getMessagesByChatId({ chatId });
  console.log(`[/api/messages] chatId=${chatId}, found ${result.data?.length ?? 0} messages, success=${result.success}`);
  return NextResponse.json({ messages: result.data ?? [] });
}
