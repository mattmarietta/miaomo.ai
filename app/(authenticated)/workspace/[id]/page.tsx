"use client";

import { useAuth } from "@/components/Auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    // Redirect to a new chat with a generated ID
    const newChatId = crypto.randomUUID();
    router.replace(`/workspace/${id}/chat/${newChatId}`);
  }, [user, loading, router, id]);

  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}
