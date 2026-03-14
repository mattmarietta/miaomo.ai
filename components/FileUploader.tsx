"use client";

import React, { useState, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, storage } from "@/lib/firebase/firebase";
import { Button } from "@/components/ui/button";
import { CirclePlus, Loader2 } from "lucide-react";
import {useParams} from "next/navigation";

type FileUploaderProps = {
    workspaceId?: string;
    onUpload?: (payload: { file: File; downloadUrl: string }) => void;
};

export default function FileUploader({ onUpload }: FileUploaderProps) {
    const [progress, setProgress] = useState<number>(0);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const params = useParams();
    const workspaceId = params.workspaceId as string;

    const handleButtonClick = () => fileInputRef.current?.click();

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        //allow re-uploading same file later
        e.currentTarget.value = "";

        if (!file) return;

        setUploading(true);
    
        const user = auth.currentUser;

        if (!user) {
            console.error("No user authenticated!");
            setUploading(false);
            return;
        }

        const fileId = crypto.randomUUID(); 
        const storagePath = `workspaces/${workspaceId}/files/${fileId}/original.pdf`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
        });

        uploadTask.on("state_changed",
            (snapshot) => {
                const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setProgress(Math.round(prog));
            },
            (error) => {
                console.error("Upload error:", error);
                setUploading(false);
            },
            async () => {
                try{
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    await onUpload?.({ file, downloadUrl: url });
                    console.log("File available at: ", url);
                }finally{
                    setUploading(false);
                    setProgress(0);
                }
            }
        );
    };

    return (
        <div className="flex flex-col items-center">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleUpload} 
                accept="application/pdf,image/*" //accept PDFs and imgs
                className="hidden" 
            />
            <Button 
                type="button"
                variant="ghost"
                disabled={uploading}
                onClick={handleButtonClick}
                className="group h-auto p-0 flex flex-col items-center gap-2 hover:bg-transparent active:scale-95 transition-all"
            >
                {/* Square Icon Container */}
                <div className="relative flex items-center justify-center gap-3 w-40 h-16 rounded-2xl bg-background border border-border shadow-sm group-hover:shadow-md transition-all px-4">
                    {uploading ? (
                        <div className="flex items-center gap-3">
                            <div className="relative flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-primary animate-spin" strokeWidth={2} />
                                <span className="absolute-text-[10px] font-bold text-primary">
                                    {progress}%
                                </span>
                            </div>
                            <span className="text-[9px] text-muted-foreground uppercase tracking-tight">
                                Uploading
                            </span>
                        </div>
                    ) : (
                        /* Default State */
                        <>
                            <CirclePlus
                                size={24}
                                className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0"
                                strokeWidth={1.5}
                            />
                            <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-wide">
                                Upload File
                            </span>
                        </>
                    )}
                </div>
            </Button>
        </div>
    );
}