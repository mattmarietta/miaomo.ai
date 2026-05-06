"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, ChevronDown, Paperclip, Loader2, FileText, X, BookOpen, Search, Globe, GraduationCap, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import Markdown from "react-markdown";
import { DefaultChatTransport } from "ai";
import { ChatAgent } from "@/app/api/chat/ai";
import { User } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/firebase";
import { addWorkspaceFile, generateWorkspaceFileId } from "@/lib/firebase/client-queries";
import { DBWorkspaceFileSchema } from "@/lib/firebase/schema";
import { createQuiz, updateQuiz, generateId as generateQuizId, type Question } from "@/lib/firebase/quizStore";
import { createDeck, updateDeck, createNewCard } from "@/lib/firebase/flashcardStore";

interface ToolPart {
    type: string;
    toolCallId: string;
    state: "input-streaming" | "input-available" | "output-available" | "error";
    input?: Record<string, unknown>;
    output?: unknown;
    errorText?: string;
}

interface TextPart {
    type: "text";
    text?: string;
}

type MessagePart = TextPart | ToolPart | { type: string };

interface Message {
    id: string;
    role: "user" | "assistant";
    parts: MessagePart[];
}

const models = [
    { label: "Fast", value: "gemini-2.0-flash" },
    { label: "Balanced", value: "gemini-2.5-flash" },
    { label: "Smart", value: "gemini-2.5-pro" },
];

export interface Citation {
    fileId: string;
    fileName: string;
    page?: number;
    chunkIndex: number;
    text: string;
    score: number;
}

interface ChatProps {
    user: User;
    initialMessages: ChatAgent[];
    chatId?: string;
    workspaceId?: string;
    files?: DBWorkspaceFileSchema[];
    onFileClick?: (file: DBWorkspaceFileSchema) => void;
    onCitationClick?: (citation: Citation) => void;
    externalMessage?: string;
    onExternalMessageSent?: () => void;
    hideExternalMessage?: boolean;
}

export function Chat({ user, initialMessages, chatId, workspaceId, files = [], onFileClick, onCitationClick, externalMessage, onExternalMessageSent, hideExternalMessage }: ChatProps) {
    const router = useRouter();
    const [webSearchMode, setWebSearchMode] = useState(false);
    const [selectedModel, setSelectedModel] = useState(models[0]);
    const [modelOpen, setModelOpen] = useState(false);
    const transport = useMemo(() => new DefaultChatTransport({
        api: "/api/chat",
        body: workspaceId ? { workspaceId, webSearchMode, model: selectedModel.value } : undefined,
    }), [workspaceId, webSearchMode, selectedModel]);
    const { messages, sendMessage, status } = useChat<ChatAgent>({
        id: chatId,
        transport,
        messages: initialMessages,
    });
    const [input, setInput] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [lastMessageWasExternal, setLastMessageWasExternal] = useState(false);
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

    // Handle external message
    useEffect(() => {
        if (externalMessage) {
            user.getIdToken().then(idToken => {
                sendMessage({ text: externalMessage }, {
                    headers: {
                        "Authorization": `Bearer ${idToken}`
                    },
                    body: {
                        attachedFiles: [],
                        model: selectedModel.value,
                    },
                });
                setLastMessageWasExternal(true);
                onExternalMessageSent?.();
            });
        }
    }, [externalMessage, sendMessage, selectedModel, onExternalMessageSent, user]);

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
            setLastMessageWasExternal(false); // Reset flag when user sends manual message
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !workspaceId) return;

        setUploading(true);
        setUploadProgress(0);

        const fileId = generateWorkspaceFileId(workspaceId);
        const storagePath = `workspaces/${workspaceId}/files/${fileId}/${file.name}`;
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
                    }, fileId);
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
                {/* Web search mode indicator */}
                {webSearchMode && (
                    <div className="flex items-center gap-1.5 mb-2">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-xs font-medium">
                            <Globe className="size-3" />
                            Web search enabled
                            <button
                                type="button"
                                onClick={() => setWebSearchMode(false)}
                                className="ml-0.5 p-0.5 rounded hover:bg-blue-500/20"
                            >
                                <X className="size-3" />
                            </button>
                        </span>
                    </div>
                )}

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

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className={`h-7 w-7 rounded-full transition-colors ${
                                    webSearchMode
                                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                                onClick={() => setWebSearchMode((prev) => !prev)}
                                title={webSearchMode ? "Web search enabled" : "Enable web search"}
                            >
                                <Globe size={14} />
                            </Button>

                            <Popover open={modelOpen} onOpenChange={setModelOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 rounded-full text-xs gap-1"
                                    >
                                        {selectedModel.label}
                                        <ChevronDown size={12} className="text-muted-foreground" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-32 p-1" align="start">
                                    <Command>
                                        <CommandList>
                                            <CommandGroup>
                                                {models.map((model) => (
                                                    <CommandItem
                                                        key={model.value}
                                                        value={model.value}
                                                        onSelect={() => {
                                                            setSelectedModel(model);
                                                            setModelOpen(false);
                                                        }}
                                                        className="text-sm cursor-pointer"
                                                    >
                                                        {model.label}
                                                        {selectedModel.value === model.value && (
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

                { /*Study Tools button*/ }
                <button
                    onClick={() => router.push("/workspace-public/quiz-builder")}
                    className="absolute bottom-6 left-6 px-4 py-2 border rounded-xl text-sm hover:bg-muted"
                >
                    <BookOpen size={16} />
                    Study Tools
                </button>
            </div>
        );
    }

    // ── Conversation view ──
    return (
        <div className="flex flex-col h-full min-h-0 bg-background">
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-5 py-5">
                    <div className="flex flex-col gap-6">
                        {(messages as Message[]).map((message) => {
                            const isUser = message.role === "user";
                            return (
                            <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                                <div className={`${isUser ? "max-w-[85%]" : "max-w-full w-full"}`}>
                                    {!isUser && (
                                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                                            Assistant
                                        </p>
                                    )}
                                    <div className={`text-[14px] leading-relaxed ${
                                        isUser
                                            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5"
                                            : "text-foreground prose prose-sm prose-neutral dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:my-2 prose-pre:bg-muted prose-pre:rounded-lg prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none"
                                    }`}>
                                    {message.parts.map((part: MessagePart, i: number) => {
                                        switch (part.type) {
                                            case "text": {
                                                const rawText = (part as TextPart).text || "";
                                                const fileRefPattern = /\[Referencing file: (.+?)\]/g;
                                                const referencedFiles: string[] = [];
                                                let match;
                                                while ((match = fileRefPattern.exec(rawText)) !== null) {
                                                    referencedFiles.push(match[1]);
                                                }
                                                const displayText = rawText
                                                    .replace(/\[Referencing file: .+?\]\n*/g, "")
                                                    .trim();

                                                if (isUser) {
                                                    return (
                                                        <div key={`${message.id}-${i}`}>
                                                            {referencedFiles.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 mb-2">
                                                                    {referencedFiles.map((name) => {
                                                                        const matchedFile = files.find((f) => f.originalName === name);
                                                                        const ext = name.split(".").pop()?.toUpperCase() || "FILE";
                                                                        return (
                                                                            <button
                                                                                key={name}
                                                                                type="button"
                                                                                onClick={() => matchedFile && onFileClick?.(matchedFile)}
                                                                                className="flex items-center gap-2.5 rounded-xl bg-primary-foreground/15 backdrop-blur-sm px-3 py-2 text-left transition-all hover:bg-primary-foreground/25 cursor-pointer group"
                                                                            >
                                                                                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-foreground/20 group-hover:bg-primary-foreground/30 transition-colors">
                                                                                    <FileText size={16} className="text-primary-foreground" />
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <p className="text-[13px] font-medium text-primary-foreground truncate max-w-[200px]">{name}</p>
                                                                                    <p className="text-[10px] text-primary-foreground/60">
                                                                                        {ext}
                                                                                        {matchedFile?.size ? ` · ${(matchedFile.size / 1024).toFixed(0)} KB` : ""}
                                                                                    </p>
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                            {displayText && <p className="m-0 whitespace-pre-wrap">{displayText}</p>}
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <Markdown key={`${message.id}-${i}`}>
                                                        {displayText}
                                                    </Markdown>
                                                );
                                            }
                                            case "tool-searchDocuments": {
                                                const tp = part as ToolPart;
                                                const rawQuery = tp.input?.query ?? tp.input?.queries;
                                                const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
                                                const isDone = tp.state === "output-available";
                                                const results = isDone ? ((tp.output as any)?.results ?? []) : [];
                                                const resultCount = results.length;
                                                const sourceFiles: string[] = isDone
                                                    ? [...new Set(results.map((r: any) => r.fileName).filter(Boolean))] as string[]
                                                    : [];
                                                return (
                                                    <div key={`${message.id}-${i}`}>
                                                        <div
                                                            className={`flex items-start gap-2.5 py-2.5 px-3.5 my-2 rounded-xl text-xs transition-colors ${
                                                                isDone
                                                                    ? "bg-emerald-500/5 border border-emerald-500/15 text-muted-foreground"
                                                                    : "bg-muted/50 border border-border/50 text-muted-foreground"
                                                            }`}
                                                        >
                                                            {isDone ? (
                                                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 mt-0.5 shrink-0">
                                                                    <Search size={11} className="text-emerald-600 dark:text-emerald-400" />
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 mt-0.5 shrink-0">
                                                                    <Loader2 size={11} className="animate-spin text-primary" />
                                                                </div>
                                                            )}
                                                            <div className="min-w-0 flex-1">
                                                                <span className={isDone ? "text-emerald-700 dark:text-emerald-300 font-medium" : ""}>
                                                                    {isDone
                                                                        ? `Found ${resultCount} result${resultCount !== 1 ? "s" : ""}`
                                                                        : `Searching for "${query}"...`
                                                                    }
                                                                </span>
                                                                {isDone && <span className="text-muted-foreground"> for &ldquo;{query}&rdquo;</span>}
                                                                {isDone && sourceFiles.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                                        {sourceFiles.map((name: string) => (
                                                                            <span key={name} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-medium">
                                                                                <FileText size={10} />
                                                                                {decodeURIComponent(name)}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {/* Citation cards */}
                                                        {isDone && results.length > 0 && (
                                                            <div className="flex gap-2 overflow-x-auto py-2 scrollbar-none [&::-webkit-scrollbar]:hidden">
                                                                {results.map((r: any, ri: number) => (
                                                                    <button
                                                                        key={`${r.fileId}-${r.chunkIndex}-${ri}`}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const citation = {
                                                                                fileId: r.fileId,
                                                                                fileName: decodeURIComponent(r.fileName || "unknown"),
                                                                                page: r.page,
                                                                                chunkIndex: r.chunkIndex,
                                                                                text: r.text,
                                                                                score: r.score,
                                                                            };
                                                                            if (onCitationClick) {
                                                                                onCitationClick(citation);
                                                                            } else if (onFileClick) {
                                                                                const file = files.find(f => f.id === r.fileId);
                                                                                if (file) onFileClick(file);
                                                                            }
                                                                        }}
                                                                        className="flex-shrink-0 flex flex-col gap-1 rounded-lg border border-border bg-card p-2.5 text-left text-xs hover:bg-muted/50 transition-colors max-w-[200px] cursor-pointer"
                                                                    >
                                                                        <div className="flex items-center gap-1.5">
                                                                            <FileText size={10} className="text-primary shrink-0" />
                                                                            <span className="font-medium text-foreground truncate">
                                                                                {decodeURIComponent(r.fileName || "unknown")}
                                                                            </span>
                                                                        </div>
                                                                        {r.page != null && (
                                                                            <span className="inline-flex items-center rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium w-fit">
                                                                                Page {r.page}
                                                                            </span>
                                                                        )}
                                                                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                                                                            {(r.text || "").slice(0, 100)}...
                                                                        </p>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            case "tool-webSearch": {
                                                const tp = part as ToolPart;
                                                const rawQuery = tp.input?.query ?? tp.input?.queries;
                                                const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
                                                const isDone = tp.state === "output-available";
                                                return (
                                                    <div
                                                        key={`${message.id}-${i}`}
                                                        className={`flex items-start gap-2.5 py-2.5 px-3.5 my-2 rounded-xl text-xs transition-colors ${
                                                            isDone
                                                                ? "bg-blue-500/5 border border-blue-500/15 text-muted-foreground"
                                                                : "bg-muted/50 border border-border/50 text-muted-foreground"
                                                        }`}
                                                    >
                                                        {isDone ? (
                                                            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 mt-0.5 shrink-0">
                                                                <Globe size={11} className="text-blue-600 dark:text-blue-400" />
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 mt-0.5 shrink-0">
                                                                <Loader2 size={11} className="animate-spin text-blue-600 dark:text-blue-400" />
                                                            </div>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <span className={isDone ? "text-blue-700 dark:text-blue-300 font-medium" : ""}>
                                                                {isDone
                                                                    ? "Web search complete"
                                                                    : `Searching the web for "${query}"...`
                                                                }
                                                            </span>
                                                            {isDone && <span className="text-muted-foreground"> for &ldquo;{query}&rdquo;</span>}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            case "tool-createQuiz": {
                                                const tp = part as ToolPart;
                                                const isDone = tp.state === "output-available";
                                                const result = isDone ? (tp.output as any) : null;
                                                const success = result?.success;
                                                return (
                                                    <div
                                                        key={`${message.id}-${i}`}
                                                        className={`my-2 rounded-xl border text-sm transition-colors ${
                                                            isDone && success
                                                                ? "border-violet-500/20 bg-violet-500/5"
                                                                : isDone
                                                                    ? "border-destructive/20 bg-destructive/5"
                                                                    : "border-border/50 bg-muted/50"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 px-4 py-3">
                                                            {isDone && success ? (
                                                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10 shrink-0">
                                                                    <GraduationCap size={16} className="text-violet-600 dark:text-violet-400" />
                                                                </div>
                                                            ) : !isDone ? (
                                                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                                                                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                                                                </div>
                                                            ) : null}
                                                            <div className="min-w-0 flex-1">
                                                                {isDone && success ? (
                                                                    <>
                                                                        <p className="font-medium text-violet-700 dark:text-violet-300">{result.title}</p>
                                                                        <p className="text-xs text-muted-foreground mt-0.5">{result.questionCount} questions ready</p>
                                                                    </>
                                                                ) : isDone ? (
                                                                    <p className="text-destructive text-xs">{result?.message || "Failed to create quiz"}</p>
                                                                ) : (
                                                                    <p className="text-muted-foreground">Generating quiz questions...</p>
                                                                )}
                                                            </div>
                                                            {isDone && success && (
                                                                <Button
                                                                    size="sm"
                                                                    className="shrink-0 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                                                                    onClick={async () => {
                                                                        try {
                                                                            const quiz = await createQuiz(user.uid, result.title, result.description || "");
                                                                            const questions: Question[] = result.questions.map((aq: any) => {
                                                                                const q: Question = {
                                                                                    id: generateQuizId(),
                                                                                    type: aq.type,
                                                                                    question: aq.question || "",
                                                                                    correctAnswer: aq.correctAnswer || "",
                                                                                    points: 1,
                                                                                    box: 1,
                                                                                };
                                                                                if (aq.explanation) q.explanation = aq.explanation;
                                                                                if (aq.type === "multiple-choice" && aq.options) {
                                                                                    q.options = aq.options.map((text: string) => ({ id: generateQuizId(), text }));
                                                                                    const correctIndex = aq.options.findIndex((opt: string) => opt === aq.correctAnswer);
                                                                                    if (correctIndex >= 0 && q.options![correctIndex]) {
                                                                                        q.correctAnswer = q.options![correctIndex].id;
                                                                                    } else {
                                                                                        const letterIndex = ["A", "B", "C", "D"].indexOf(aq.correctAnswer || "");
                                                                                        if (letterIndex >= 0 && q.options![letterIndex]) {
                                                                                            q.correctAnswer = q.options![letterIndex].id;
                                                                                        }
                                                                                    }
                                                                                }
                                                                                if (aq.type === "matching" && aq.matchingPairs) {
                                                                                    q.matchingPairs = aq.matchingPairs.map((p: any) => ({
                                                                                        id: generateQuizId(),
                                                                                        term: p.term,
                                                                                        definition: p.definition,
                                                                                    }));
                                                                                    q.points = aq.matchingPairs.length;
                                                                                }
                                                                                return q;
                                                                            });
                                                                            await updateQuiz(quiz.id, { questions });
                                                                            window.open(`/workspace-public/quiz-builder/${quiz.id}/take`, "_blank");
                                                                        } catch (err) {
                                                                            console.error("Failed to create quiz:", err);
                                                                        }
                                                                    }}
                                                                >
                                                                    <GraduationCap size={14} />
                                                                    Take Quiz
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            case "tool-createFlashcards": {
                                                const tp = part as ToolPart;
                                                const isDone = tp.state === "output-available";
                                                const result = isDone ? (tp.output as any) : null;
                                                const success = result?.success;
                                                return (
                                                    <div
                                                        key={`${message.id}-${i}`}
                                                        className={`my-2 rounded-xl border text-sm transition-colors ${
                                                            isDone && success
                                                                ? "border-amber-500/20 bg-amber-500/5"
                                                                : isDone
                                                                    ? "border-destructive/20 bg-destructive/5"
                                                                    : "border-border/50 bg-muted/50"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 px-4 py-3">
                                                            {isDone && success ? (
                                                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 shrink-0">
                                                                    <Layers size={16} className="text-amber-600 dark:text-amber-400" />
                                                                </div>
                                                            ) : !isDone ? (
                                                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                                                                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                                                                </div>
                                                            ) : null}
                                                            <div className="min-w-0 flex-1">
                                                                {isDone && success ? (
                                                                    <>
                                                                        <p className="font-medium text-amber-700 dark:text-amber-300">{result.title}</p>
                                                                        <p className="text-xs text-muted-foreground mt-0.5">{result.cardCount} cards ready</p>
                                                                    </>
                                                                ) : isDone ? (
                                                                    <p className="text-destructive text-xs">{result?.message || "Failed to create flashcards"}</p>
                                                                ) : (
                                                                    <p className="text-muted-foreground">Generating flashcards...</p>
                                                                )}
                                                            </div>
                                                            {isDone && success && (
                                                                <Button
                                                                    size="sm"
                                                                    className="shrink-0 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                                                                    onClick={async () => {
                                                                        try {
                                                                            const deck = await createDeck(user.uid, result.title, result.description || "");
                                                                            const cards = result.cards.map((c: any) => createNewCard(c.front, c.back));
                                                                            await updateDeck(deck.id, { cards });
                                                                            window.open(`/workspace-public/quiz-builder/flashcards/${deck.id}/study`, "_blank");
                                                                        } catch (err) {
                                                                            console.error("Failed to create flashcard deck:", err);
                                                                        }
                                                                    }}
                                                                >
                                                                    <Layers size={14} />
                                                                    Study Cards
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            default:
                                                return null;
                                        }
                                    })}
                                    </div>
                                </div>
                            </div>
                            );
                        })}

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
