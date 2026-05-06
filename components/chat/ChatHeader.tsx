"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/components/Auth";
import { subscribeWorkspaceChats } from "@/lib/firebase/client-queries";
import { DBChatSchema } from "@/lib/firebase/schema";

export function ChatHeader() {
  const params = useParams<{ id?: string; chatId?: string }>();
  const { user } = useAuth();
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!params?.id || !params?.chatId || !user) {
      setTitle("");
      return;
    }

    const unsub = subscribeWorkspaceChats(params.id, user.uid, (chats: DBChatSchema[]) => {
      const chat = chats.find((c) => c.id === params.chatId);
      setTitle(chat?.title || "New Chat");
    });
    return () => unsub();
  }, [params?.id, params?.chatId, user]);

  return (
    <div className="p-1 shrink border-b border-muted flex gap-1 text-sm items-center font-medium">
      <SidebarTrigger />
      {title && <span className="truncate">{title}</span>}
    </div>
  );
}
