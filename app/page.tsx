"use client";
import { createChatMessage, fetchChatMessages, type ChatMessage } from "@/lib/firebase/chatStore";
import Image from "next/image";

import { useEffect, useState } from "react";

export default function HomePage() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);

    // Load chat history from central DB
    useEffect(() => {
        const load = async () => {
            const data = await fetchChatMessages();
            setMessages(data);
            setLoading(false);
        };
        load();
    }, []);

    const sendUserMessage = async () => {
        if (!input.trim()) return;
        const userMsg = await createChatMessage("user", input.trim());
        setMessages((prev) => [...prev, userMsg]);
        setInput("");

        // later: call AI API, then:
        // const aiReply = await createChatMessage("assistant", aiText);
        // setMessages((prev) => [...prev, aiReply]);
    };

    return (
        <main className="flex justify-center items-center h-screen flex-col">
            <h1>Miamo.ai · Chat AI log</h1>

            <div>
                {loading ? (
                    <p>Loading conversation…</p>
                ) : messages.length === 0 ? (
                    <p>No messages yet. Start a conversation.</p>
                ) : (
                    messages.map((m) => (
                        <p key={m.id}>
                            <strong>{m.role === "user" ? "You" : "miamo"}:</strong> {m.content}
                        </p>
                    ))
                )}
            </div>

            <div className="flex flex-col w-full max-w-3xl">
                <textarea
                    className="border rounded-3xl max-w-3xl w-full p-4"
                    rows={3}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Miaomo something…"
                />
                <button className="bg-zinc-100 rounded-full p-2 border border-zinc-200" onClick={sendUserMessage}>
                    Send to miamo
                </button>
            </div>
        </main>
    );
}
