"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/firebase";
import { FileText } from "lucide-react";

interface UploadedFile {
    id: string;
    name: string;
    url: string;
}

interface FileLibraryProps {
    onFileSelect: (url: string) => void;
    selectedPdfUrl: string | null;
}

export default function FileLibrary({ onFileSelect, selectedPdfUrl } : FileLibraryProps) {
    const [fileList, setFileList] = useState<UploadedFile[]>([]);

    // listen for real-time updates to user's uploaded files
    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (user) {
                const q = query(
                    collection(db, `users/${user.uid}/uploads`),
                    orderBy("uploadedAt", "desc")
                );

                const unsubSnap = onSnapshot(q, (snapshot) => {
                    const files = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as UploadedFile));
                    setFileList(files);
                });

                return () => unsubSnap();
            } else {
                setFileList([]);
            }
        });

        return () => unsubscribeAuth();

    }, []);

    return (
        <div className="flex w-full h-[800px] gap-6 border rounded-xl bg-background p-4 shadow-sm mt-6">
            {/* Left Sidebar: Scroll List */}
            <div className="flex flex-col w-1/3 min-w-[250px] border-r pr-4">
                <div className="flex flex-col flex-1 overflow-y-auto gap-2 pr-2">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Your Documents
                    </h3>
                    {fileList.length === 0 && (
                        <p className="text-sm text-muted-foreground italic text-center mt-4">
                            No files uploaded yet...
                        </p>
                    )}

                    {fileList.map((file) => (
                        <button 
                            key={file.id}
                            onClick={() => onFileSelect(file.url)}
                            className={`flex items-center gap-3 w-full p-3 rounded-lg text-left transition-colors border ${
                                selectedPdfUrl === file.url
                                ? "bg-primary/10 border-primary/30"
                                : "bg-card hover:bg-accent border-transparent hover:border-border"
                            }`}
                        >
                            <FileText size={18} className={selectedPdfUrl === file.url ? "text-primary" : "text-muted-foreground"} />
                            <span className="text-sm font-medium truncate w-full">
                                {file.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Side: PDF Viewer */}
            <div className = "flex-1 flex flex-col bg-muted/10 rounded-lg border overflow-hidden relative">
                {selectedPdfUrl ? (
                    <iframe 
                        src={selectedPdfUrl}
                        className="w-full h-full"
                        title="PDF Viewer"
                    />

                ) : ( 
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                        <FileText size={48} className="mb-4 opacity-20" />
                        <p>Select file from the list to view it.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

