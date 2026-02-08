"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";
import { ArrowUp, Plus, FileText, Globe, X, MessageSquare, Check, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import FileUploader from "@/components/FileUploader";
import Markdown from "react-markdown";

interface ChatTab {
    id: string;
    title: string;
}

const models = ["Opus 4.5", "Sonnet 4", "Haiku 3.5", "GPT-4o"];

export default function Chat() {
    const { messages, sendMessage, status } = useChat();
    const [input, setInput] = useState("");
    const [tabs, setTabs] = useState<ChatTab[]>([{ id: "chat-1", title: "New Chat" }]);
    const [activeTab, setActiveTab] = useState("chat-1");
    const [selectedModel, setSelectedModel] = useState("Opus 4.5");
    const [modelOpen, setModelOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
        }
    }, [input]);

    const addTab = () => {
        const newTab = { id: `chat-${Date.now()}`, title: "New Chat" };
        setTabs([...tabs, newTab]);
        setActiveTab(newTab.id);
    };

    const closeTab = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (tabs.length > 1) {
            const newTabs = tabs.filter((tab) => tab.id !== id);
            setTabs(newTabs);
            if (activeTab === id) {
                setActiveTab(newTabs[0].id);
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            sendMessage({ text: input });
            setInput("");
        }
    };

    const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrError, setOcrError] = useState<string | null>(null);

    const handleFilesUpload = async (files: File[]) => {
        setOcrError(null);
        setOcrLoading(true);
        try {
            const form = new FormData();
            files.forEach((f) => form.append("files", f));

            const res = await fetch("/api/vision", { method: "POST", body: form });

            if (!res.ok) {
            const text = await res.text().catch(()=>res.statusText);
            setOcrError(`Server error: ${res.status} ${text?.slice?.(0,200) || ""}`);
            setOcrLoading(false);
            return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setPreviewPdfUrl(url);
            } catch (err: any) {
                setOcrError(err?.message || "Upload failed");
            } finally {
                setOcrLoading(false);
            }
    };

    return (
        <div className="flex h-dvh w-full overflow-hidden bg-background">
            {/* Left Side */}
            <div className="flex flex-col flex-1 min-w-0 bg-muted/30">
                {/* Top Section / PDF Viewer Area */}
                <main className="grow flex items-center justify-center overflow-auto p-4">
                    <div className="text-muted-foreground">
                        PDF Preview Space
                    </div>
                </main>
                
                {/* Bottom Section */}
                <div className="h-24 shrink-0 border-t border-border/50 bg-background/50 flex items-center justify-center">
                        {/* Uploader */}
                        <FileUploader onUpload={handleFilesUpload} />
                </div>
            </div>

            <div className="flex flex-col flex-1 min-w-0 border-l border-border bg-card">
                {/* Chat Panel */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                    {/* Tab Bar */}
                    <div className="flex items-center gap-1 px-2 py-2 border-b border-border">
                        <TabsList className="h-8 p-0.5 bg-muted/50">
                            {tabs.map((tab) => (
                                <TabsTrigger
                                    key={tab.id}
                                    value={tab.id}
                                    className="group relative h-7 px-3 gap-1.5 text-xs data-[state=active]:bg-background"
                                >
                                    <MessageSquare size={12} />
                                    <span className="max-w-20 truncate">{tab.title}</span>
                                    {tabs.length > 1 && (
                                        <span
                                            onClick={(e) => closeTab(tab.id, e)}
                                            className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity"
                                        >
                                            <X size={12} />
                                        </span>
                                    )}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <Button variant="ghost" size="icon-sm" onClick={addTab}>
                            <Plus size={16} />
                        </Button>
                    </div>

                    {/* Chat Content */}
                    {tabs.map((tab) => (
                        <TabsContent key={tab.id} value={tab.id} className="flex-1 flex flex-col m-0 overflow-hidden">
                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto px-5 py-5">
                                {messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full">
                                        <Sparkles size={24} className="text-muted-foreground/40 mb-3" />
                                        <p className="text-sm text-muted-foreground">Ask anything</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-6">
                                        {messages.map((message) => (
                                            <div key={message.id}>
                                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                                                    {message.role === "user" ? "You" : "Assistant"}
                                                </p>
                                                <div className="text-[14px] leading-relaxed text-foreground prose prose-sm prose-neutral dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:my-2 prose-pre:bg-muted prose-pre:rounded-lg prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                                                    {message.parts.map((part, i) => {
                                                        switch (part.type) {
                                                            case "text":
                                                                return (
                                                                    <Markdown key={`${message.id}-${i}`}>
                                                                        {part.text}
                                                                    </Markdown>
                                                                );
                                                            default:
                                                                return null;
                                                        }
                                                    })}
                                                </div>
                                            </div>
                                        ))}

                                        {status === "streaming" && messages[messages.length - 1]?.role === "user" && (
                                            <div>
                                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                                                    Assistant
                                                </p>
                                                <div className="flex gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse" />
                                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:150ms]" />
                                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:300ms]" />
                                                </div>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="w-full px-4 pb-6 flex flex-col items-center">
                                <form onSubmit={handleSubmit} className="w-full">
                                    <div className="w-full rounded-3xl border border-border bg-card shadow-xs focus-within:ring-2 focus-within:ring-ring/20 transition-shadow">
                                        <textarea
                                            ref={textareaRef}
                                            className="w-full px-4 pt-3 pb-2 text-sm bg-transparent resize-none focus:outline-none leading-relaxed scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] placeholder:text-muted-foreground"
                                            value={input}
                                            placeholder="Ask anything..."
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSubmit(e);
                                                }
                                            }}
                                            rows={1}
                                        />

                                        <div className="flex items-center justify-between px-2 pb-2">
                                            <div className="flex items-center gap-1">
                                                <Popover open={modelOpen} onOpenChange={setModelOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 rounded-full text-xs gap-1"
                                                        >
                                                            {selectedModel}
                                                            <ChevronDown size={12} className="text-muted-foreground" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-32 p-1" align="start">
                                                        <Command>
                                                            <CommandList>
                                                                <CommandGroup>
                                                                    {models.map((model) => (
                                                                        <CommandItem
                                                                            key={model}
                                                                            value={model}
                                                                            onSelect={() => {
                                                                                setSelectedModel(model);
                                                                                setModelOpen(false);
                                                                            }}
                                                                            className="text-sm cursor-pointer"
                                                                        >
                                                                            {model}
                                                                            {selectedModel === model && (
                                                                                <Check size={14} className="ml-auto" />
                                                                            )}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 rounded-full text-xs text-muted-foreground"
                                                >
                                                    <Globe size={12} />
                                                    Web
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="h-7 w-7 rounded-full text-muted-foreground"
                                                >
                                                    <Plus size={14} />
                                                </Button>
                                            </div>

                                            <Button
                                                type="submit"
                                                size="icon-sm"
                                                disabled={!input.trim() || status === "streaming"}
                                                className="rounded-full"
                                            >
                                                <ArrowUp size={16} strokeWidth={2.5} />
                                            </Button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </div>
    );
}
