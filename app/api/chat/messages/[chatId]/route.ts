import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/lib/firebase/firebaseServer";
import { getChatMessages } from "@/lib/firebase/server-queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json("Unauthorized", { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await serverAuth.verifyIdToken(token);

    const { chatId } = await params;

    const result = await getChatMessages({ chatId });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ messages: result.data });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}