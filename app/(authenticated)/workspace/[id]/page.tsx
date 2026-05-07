"use client";

import { useAuth } from "@/components/Auth";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    const newChatId = crypto.randomUUID();
    const fileParam = searchParams.get("file");
    const target = fileParam
      ? `/workspace/${id}/chat/${newChatId}?file=${encodeURIComponent(fileParam)}`
      : `/workspace/${id}/chat/${newChatId}`;
    router.replace(target);
  }, [user, loading, router, id, searchParams]);

  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}
