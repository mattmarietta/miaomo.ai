"use client";

import { useAuth } from "@/components/Auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Chat } from "@/components/chat/Chat";
import { fetchChatMessages, fetchChatMessagesById } from "@/lib/firebase/chatStore";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if(loading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const getAllMsg = async () => {
      console.log("called")
      const msg = await fetchChatMessagesById(id, user.uid);
      console.log(msg)
    }
    getAllMsg()
  }, [user, loading, router, id]);


  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;





  return <Chat user={user} />
}