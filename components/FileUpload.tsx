"use client";

import { useState, useRef, useEffect } from "react";

interface StoredFile {
    filename: string;
    size: number;
    type: string;
    uploadedAt: string;
}

const STORAGE_KEY = "lastDemoUpload";

export default function FileUploadForm() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [storedFile, setStoredFile] = useState<StoredFile | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const lastUpload = localStorage.getItem(STORAGE_KEY);
            if (lastUpload) {
                const parsed: StoredFile = JSON.parse(lastUpload);
                setStoredFile(parsed);
            }
        } catch (error) {
            console.error("Error loading from localStorage:", error);
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setMessage(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage({ type: "error", text: "Please select a file first." });
            return;
        }

        setUploading(true);
        setMessage(null);
        setUploadProgress(0);

        try {
            const progressInterval = setInterval(() => {
                setUploadProgress((prev) => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 100);

            await new Promise(resolve => setTimeout(resolve, 500));

            clearInterval(progressInterval);
            setUploadProgress(100);

            const fileData: StoredFile = {
                filename: file.name,
                size: file.size,
                type: file.type || "unknown",
                uploadedAt: new Date().toISOString(),
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(fileData));
            setStoredFile(fileData);
            setMessage({ 
                type: "success", 
                text: `File "${file.name}" uploaded successfully and saved to Local Storage!` 
            });

            setFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

        } catch (error) {
            console.error("Upload error:", error);
            setMessage({ 
                type: "error", 
                text: error instanceof Error ? error.message : "Failed to upload file. Please try again." 
            });
            setUploadProgress(0);
        } finally {
            setUploading(false);
        }
    };

    const handleReset = () => {
        setFile(null);
        setMessage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div style={{ 
            padding: '2rem', 
            border: '1px solid #e0e0e0', 
            borderRadius: '8px',
            backgroundColor: '#fff'
        }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <label 
                    htmlFor="file-input" 
                    style={{ 
                        display: 'block', 
                        marginBottom: '0.5rem',
                        fontWeight: '500',
                        color: '#000'
                    }}
                >
                    Select a file to upload:
                </label>
                <input
                    id="file-input"
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    disabled={uploading}
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '1rem',
                        cursor: uploading ? 'not-allowed' : 'pointer'
                    }}
                />
            </div>

            {file && (
                <div style={{ 
                    marginBottom: '1rem', 
                    padding: '0.75rem',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    color: '#000'
                }}>
                    <strong>Selected file:</strong> {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </div>
            )}

            {uploading && (
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ 
                        width: '100%', 
                        height: '20px', 
                        backgroundColor: '#e0e0e0', 
                        borderRadius: '10px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${uploadProgress}%`,
                            height: '100%',
                            backgroundColor: '#4CAF50',
                            transition: 'width 0.3s ease'
                        }}></div>
                    </div>
                    <p style={{ textAlign: 'center', marginTop: '0.5rem', color: '#000' }}>
                        Uploading... {uploadProgress}%
                    </p>
                </div>
            )}

            {message && (
                <div style={{
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    borderRadius: '4px',
                    backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
                    border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
                    color: '#000'
                }}>
                    {message.text}
                </div>
            )}

            {storedFile && (
                <div style={{
                    padding: '1rem',
                    marginBottom: '1rem',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    color: '#000'
                }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Recorded in Local Storage</strong>
                        <span style={{ fontSize: '0.85rem', marginLeft: '1rem' }}>
                            Key: {STORAGE_KEY}
                        </span>
                    </div>
                    <div style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
                        <div><strong>Filename:</strong> {storedFile.filename}</div>
                        <div><strong>Size:</strong> {(storedFile.size / 1024).toFixed(2)} KB</div>
                        <div><strong>Type:</strong> {storedFile.type}</div>
                        <div><strong>Uploaded:</strong> {new Date(storedFile.uploadedAt).toLocaleString()}</div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    style={{
                        flex: 1,
                        padding: '0.75rem 1.5rem',
                        backgroundColor: uploading || !file ? '#ccc' : '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '1rem',
                        fontWeight: '500',
                        cursor: uploading || !file ? 'not-allowed' : 'pointer'
                    }}
                >
                    {uploading ? 'Uploading...' : 'Upload to Local Storage'}
                </button>
                
                {file && !uploading && (
                    <button
                        onClick={handleReset}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '1rem',
                            fontWeight: '500',
                            cursor: 'pointer'
                        }}
                    >
                        Clear
                    </button>
                )}
            </div>
        </div>
    );
}
