"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";
import { ArrowUp, Plus, FileText, Globe, X, MessageSquare, Check, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import Markdown from "react-markdown";
import { DefaultChatTransport } from "ai";
import { useAuth } from "@/components/Auth";
import { useRouter } from "next/navigation";
import { ChatAgent } from "@/app/api/chat/ai";
import { User } from "firebase/auth";
import { Chat } from "@/components/chat/Chat";



export default function ChatPage() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="flex h-dvh items-center justify-center bg-background">
                <p className="text-muted-foreground">Loading...</p>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return <Chat user={user} initialMessages={[]} />
}

