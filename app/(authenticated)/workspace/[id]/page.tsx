"use client";

import { useAuth } from "@/components/Auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Chat } from "@/components/chat/Chat";
import { ChatAgent } from "@/app/api/chat/ai";
import { fetchChatMessagesById } from "@/lib/firebase/client-queries";


export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [initialMessages, setInitialMessages] = useState<ChatAgent[] | undefined>();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetchChatMessagesById(id, user.uid)
      .then(setInitialMessages)
      .catch(() => setInitialMessages([]));
  }, [user, loading, router, id]);

  if (loading || initialMessages === undefined) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;


  return <Chat key={id} user={user} initialMessages={initialMessages} />
}