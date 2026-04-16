"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, ChevronDown, Paperclip, Loader2, FileText, X, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import Markdown from "react-markdown";
import { DefaultChatTransport } from "ai";
import { ChatAgent } from "@/app/api/chat/ai";
import { User } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/firebase";
import { addWorkspaceFile } from "@/lib/firebase/client-queries";
import { DBWorkspaceFileSchema } from "@/lib/firebase/schema";

interface Message {
    id: string;
    role: "user" | "assistant";
    parts: { type: string; text?: string }[];
}

const models = ["Opus 4.5", "Sonnet 4", "Haiku 3.5", "GPT-4o"];

interface ChatProps {
    user: User;
    initialMessages: ChatAgent[];
    workspaceId?: string;
    files?: DBWorkspaceFileSchema[];
    onFileClick?: (file: DBWorkspaceFileSchema) => void;
}

export function Chat({ user, initialMessages, workspaceId, files = [], onFileClick }: ChatProps) {
    const router = useRouter();
    const { messages, sendMessage, status } = useChat<ChatAgent>({
        transport: new DefaultChatTransport({
            api: "/api/chat",
            body: workspaceId ? { workspaceId } : undefined,
        }),
        messages: initialMessages,
    });
    const [input, setInput] = useState("");
    const [selectedModel, setSelectedModel] = useState("Opus 4.5");
    const [modelOpen, setModelOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // @-mention state
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<DBWorkspaceFileSchema[]>([]);
    const mentionRef = useRef<HTMLDivElement>(null);

    const filteredFiles = useMemo(() => {
        if (!mentionQuery) return files;
        const q = mentionQuery.toLowerCase();
        return files.filter((f) => (f.originalName || "").toLowerCase().includes(q));
    }, [files, mentionQuery]);

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

    // Reset mention index when filtered results change
    useEffect(() => {
        setMentionIndex(0);
    }, [filteredFiles.length]);

    const insertMention = useCallback((file: DBWorkspaceFileSchema) => {
        if (mentionStartPos === null) return;
        const before = input.slice(0, mentionStartPos);
        const after = input.slice(textareaRef.current?.selectionStart ?? input.length);
        const mentionText = `@${file.originalName} `;
        setInput(before + mentionText + after);
        setMentionOpen(false);
        setMentionQuery("");
        setMentionStartPos(null);
        // Track attached file (avoid duplicates)
        setAttachedFiles((prev) =>
            prev.some((f) => f.id === file.id) ? prev : [...prev, file]
        );
        // Refocus textarea
        setTimeout(() => {
            if (textareaRef.current) {
                const pos = before.length + mentionText.length;
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(pos, pos);
            }
        }, 0);
    }, [input, mentionStartPos]);

    const removeAttachedFile = (fileId: string) => {
        setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const cursorPos = e.target.selectionStart;
        setInput(val);

        // Detect @ trigger
        if (files.length > 0) {
            // Find the last @ before cursor that isn't preceded by a word character
            const textBeforeCursor = val.slice(0, cursorPos);
            const atMatch = textBeforeCursor.match(/(^|[\s])@([^\s]*)$/);

            if (atMatch) {
                const atPos = textBeforeCursor.lastIndexOf("@");
                setMentionOpen(true);
                setMentionStartPos(atPos);
                setMentionQuery(atMatch[2]);
            } else {
                setMentionOpen(false);
                setMentionStartPos(null);
                setMentionQuery("");
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (mentionOpen && filteredFiles.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((i) => (i + 1) % filteredFiles.length);
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex((i) => (i - 1 + filteredFiles.length) % filteredFiles.length);
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertMention(filteredFiles[mentionIndex]);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setMentionOpen(false);
                return;
            }
        }

        if (e.key === "Enter" && !e.shiftKey && !mentionOpen) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const idToken = await user.getIdToken();
        if (input.trim()) {
            // Build message text, prepending file references for context
            let messageText = input;
            if (attachedFiles.length > 0) {
                const fileContext = attachedFiles
                    .map((f) => `[Referencing file: ${f.originalName}]`)
                    .join("\n");
                messageText = fileContext + "\n\n" + input;
            }

            sendMessage({ text: messageText }, {
                headers: {
                    "Authorization": `Bearer ${idToken}`
                }
            });
            setInput("");
            setAttachedFiles([]);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !workspaceId) return;

        setUploading(true);
        setUploadProgress(0);

        const storagePath = `users/${user.uid}/uploads/${Date.now()}-${file.name}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on("state_changed",
            (snapshot) => {
                const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(Math.round(prog));
            },
            (err) => {
                console.error("Upload error:", err);
                setUploading(false);
            },
            async () => {
                try {
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    await addWorkspaceFile(workspaceId, {
                        originalName: file.name,
                        mimeType: file.type || "application/octet-stream",
                        size: file.size,
                        storagePath,
                        downloadUrl: url,
                        ownerUid: user.uid,
                    });
                } catch (err) {
                    console.error("Error saving file metadata:", err);
                } finally {
                    setUploading(false);
                    setUploadProgress(0);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                }
            }
        );
    };

    // ── Shared input bar (used in both empty + conversation states) ──
    const renderInputBar = (extraClass?: string) => (
        <div className={`w-full px-4 pb-6 flex flex-col items-center ${extraClass || ""}`}>
            <form onSubmit={handleSubmit} className="w-full max-w-3xl">
                {/* Attached files chips */}
                {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {attachedFiles.map((f) => (
                            <span
                                key={f.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"
                            >
                                <FileText className="size-3" />
                                <span className="truncate max-w-[150px]">{f.originalName}</span>
                                <button
                                    type="button"
                                    onClick={() => removeAttachedFile(f.id)}
                                    className="ml-0.5 p-0.5 rounded hover:bg-primary/20"
                                >
                                    <X className="size-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                <div className="relative w-full rounded-2xl border border-border bg-card shadow-xs focus-within:ring-2 focus-within:ring-ring/20 transition-shadow">
                    {/* @-mention dropdown */}
                    {mentionOpen && filteredFiles.length > 0 && (
                        <div
                            ref={mentionRef}
                            className="absolute bottom-full left-0 mb-1 w-72 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50"
                        >
                            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                                Files
                            </div>
                            <div className="max-h-48 overflow-y-auto py-1">
                                {filteredFiles.map((file, i) => (
                                    <button
                                        key={file.id}
                                        type="button"
                                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                                            i === mentionIndex
                                                ? "bg-primary/10 text-primary"
                                                : "hover:bg-muted text-foreground"
                                        }`}
                                        onMouseEnter={() => setMentionIndex(i)}
                                        onMouseDown={(e) => {
                                            e.preventDefault(); // prevent textarea blur
                                            insertMention(file);
                                        }}
                                    >
                                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium truncate">{file.originalName || "Untitled"}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {file.mimeType?.split("/")[1]?.toUpperCase() || "FILE"}
                                                {file.size ? ` · ${(file.size / 1024).toFixed(0)} KB` : ""}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        className="w-full px-4 pt-3 pb-2 text-sm bg-transparent resize-none focus:outline-none leading-relaxed scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] placeholder:text-muted-foreground"
                        value={input}
                        placeholder={files.length > 0 ? "Ask anything... (type @ to mention a file)" : "Ask anything..."}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />

                    <div className="flex items-center justify-between px-3 pb-2">
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 rounded-full text-xs gap-1.5"
                                onClick={() => router.push("/workspace/quiz-builder")}
                            >
                                <BookOpen size={14} />
                                Study Tools
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                                className="hidden"
                            />
                            {workspaceId && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                >
                                    {uploading ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Paperclip size={14} />
                                    )}
                                </Button>
                            )}

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

            {/* Upload progress */}
            {uploading && (
                <div className="w-full max-w-3xl mt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Loader2 size={12} className="animate-spin" />
                        <span>Uploading... {uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );

    const hasMessages = messages.length > 0;

    // ── Empty state (Claude.ai style) ──
    if (!hasMessages) {
        return (
            <div className="flex flex-col h-full min-h-0 bg-background">
                <div className="flex-1 flex flex-col items-center justify-center px-4">
                    <div className="w-full max-w-2xl flex flex-col items-center">
                        <h1 className="text-2xl font-semibold text-foreground mb-1">
                            What do you need help with?
                        </h1>
                        <p className="text-sm text-muted-foreground mb-8">
                            Ask questions about your files or anything else
                        </p>
                    </div>
                </div>

                {renderInputBar()}
            </div>
        );
    }

    // ── Conversation view ──
    return (
        <div className="flex flex-col h-full min-h-0 bg-background">
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-5 py-5">
                    <div className="flex flex-col gap-6">
                        {(messages as Message[]).map((message) => (
                            <div key={message.id}>
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                                    {message.role === "user" ? "You" : "Assistant"}
                                </p>
                                <div className="text-[14px] leading-relaxed text-foreground prose prose-sm prose-neutral dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:my-2 prose-pre:bg-muted prose-pre:rounded-lg prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                                    {message.parts.map((part: { type: string; text?: string }, i: number) => {
                                        switch (part.type) {
                                            case "text":
                                                return (
                                                    <Markdown key={`${message.id}-${i}`}>
                                                        {part.text || ""}
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
                </div>
            </div>

            {renderInputBar()}
        </div>
    );
}
