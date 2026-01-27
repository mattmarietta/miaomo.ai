"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

interface MessageState {
    type: "success" | "error" | "info";
    text: string;
}

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
    const [message, setMessage] = useState<MessageState | null>(null);
    const [storedFile, setStoredFile] = useState<StoredFile | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);


    useEffect(() => {
        try {
            const lastUpload = localStorage.getItem(STORAGE_KEY);
            if (lastUpload) {
                const parsed: StoredFile = JSON.parse(lastUpload);
                setStoredFile(parsed);
                setMessage({ 
                    type: "info", 
                    text: `Previous upload loaded from local storage: ${parsed.filename}` 
                });
            }
        } catch (error) {
            console.error("Error loading from localStorage:", error);
            setMessage({ type: "error", text: "Error loading previous upload record." });
        }
    }, []);

  

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setMessage(null);
        }
    }, []);

    const handleReset = useCallback(() => {
        setFile(null);
        setMessage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    const handleUpload = useCallback(async () => {
        if (!file) {
            setMessage({ type: "error", text: "Please select a file first." });
            return;
        }

        setUploading(true);
        setMessage(null);
        setUploadProgress(0);

        let progressInterval: NodeJS.Timeout | null = null;
        try {
            // Start simulated progress
            progressInterval = setInterval(() => {
                setUploadProgress((prev) => {
                    // Stop progress simulation just before 100% to simulate waiting for server response
                    if (prev >= 90) {
                        if (progressInterval) clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 100);

            // Simulate server response delay (Replace this with your actual fetch call later!)
            await new Promise(resolve => setTimeout(resolve, 1500)); 

            if (progressInterval) clearInterval(progressInterval);
            setUploadProgress(100);

            // Create data structure to save to local storage
            const fileData: StoredFile = {
                filename: file.name,
                size: file.size,
                type: file.type || "unknown",
                uploadedAt: new Date().toISOString(),
            };

            // Save metadata to browser's Local Storage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(fileData));
            setStoredFile(fileData);
            setMessage({ 
                type: "success", 
                text: `File "${file.name}" uploaded successfully and record saved!` 
            });

            handleReset(); // Reset file input after successful upload

        } catch (error) {
            console.error("Upload error:", error);
            setMessage({ 
                type: "error", 
                text: error instanceof Error ? error.message : "Failed to upload file. Please try again." 
            });
            setUploadProgress(0);
        } finally {
            if (progressInterval) clearInterval(progressInterval);
            setUploading(false);
        }
    }, [file, handleReset]); // Dependencies: file and handleReset

    //Memoized value for cleaner display
    const fileSizeKB = useMemo(() => file ? (file.size / 1024).toFixed(2) : '0.00', [file]);

    const getMessageColor = (type: MessageState['type']) => {
        switch (type) {
            case 'success': return { bg: '#d4edda', border: '#c3e6cb' };
            case 'error': return { bg: '#f8d7da', border: '#f5c6cb' };
            case 'info': return { bg: '#cce5ff', border: '#b8daff' };
            default: return { bg: '#fff', border: '#eee' };
        }
    };
    

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>File Upload</h2>

            {/* File Input Section */}
            <div style={styles.section}>
                <label htmlFor="file-input" style={styles.label}>
                    Select a file:
                </label>
                <input
                    id="file-input"
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    disabled={uploading}
                    style={styles.fileInput}
                />
            </div>

            {/* Selected File Details */}
            {file && !uploading && (
                <div style={styles.fileDetails}>
                    <strong>Selected:</strong> {file.name} ({fileSizeKB} KB)
                </div>
            )}

            {/* Upload Progress Bar */}
            {uploading && (
                <div style={styles.section}>
                    <div style={styles.progressBarContainer}>
                        <div style={{ ...styles.progressBarFill, width: `${uploadProgress}%` }}></div>
                    </div>
                    <p style={styles.progressText}>
                        {uploadProgress < 100 ? 'Uploading...' : 'Processing...'} {uploadProgress}%
                    </p>
                </div>
            )}

            {/* Messages */}
            {message && (
                <div style={{
                    ...styles.messageBox,
                    backgroundColor: getMessageColor(message.type).bg,
                    border: `1px solid ${getMessageColor(message.type).border}`,
                }}>
                    {message.text}
                </div>
            )}

            {/* Local Storage Record */}
            {storedFile && (
                <div style={styles.storedFileBox}>
                    <h3 style={styles.storedFileTitle}>Last Recorded Upload (from Local Storage)</h3>
                    <div style={styles.storedFileDetails}>
                        <div><strong>Filename:</strong> {storedFile.filename}</div>
                        <div><strong>Size:</strong> {(storedFile.size / 1024).toFixed(2)} KB</div>
                        <div><strong>Type:</strong> {storedFile.type}</div>
                        <div><strong>Uploaded:</strong> {new Date(storedFile.uploadedAt).toLocaleString()}</div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div style={styles.buttonGroup}>
                <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    style={styles.uploadButton(file, uploading)}
                >
                    {uploading ? 'Uploading...' : 'Simulate Upload & Save Record'}
                </button>

                {file && !uploading && (
                    <button
                        onClick={handleReset}
                        style={styles.resetButton}
                    >
                        Clear
                    </button>
                )}
            </div>
        </div>
    );
}

//Style separated from the JSX
const styles = {
    container: {
        padding: '2rem',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
        maxWidth: '500px',
        margin: '20px auto',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
    },
    title: {
        marginBottom: '1.5rem',
        textAlign: 'center' as 'center',
        color: '#333'
    },
    section: {
        marginBottom: '1.5rem'
    },
    label: {
        display: 'block',
        marginBottom: '0.5rem',
        fontWeight: '600',
        color: '#333'
    },
    fileInput: {
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #ccc',
        borderRadius: '4px',
        fontSize: '1rem',
        cursor: 'pointer'
    },
    fileDetails: {
        marginBottom: '1rem',
        padding: '0.75rem',
        backgroundColor: '#e6f7ff',
        borderRadius: '4px',
        border: '1px solid #b3d9ff',
        color: '#0056b3'
    },
    progressBarContainer: {
        width: '100%',
        height: '20px',
        backgroundColor: '#e0e0e0',
        borderRadius: '10px',
        overflow: 'hidden' as 'hidden'
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#28a745',
        transition: 'width 0.3s ease'
    },
    progressText: {
        textAlign: 'center' as 'center',
        marginTop: '0.5rem',
        color: '#333'
    },
    messageBox: {
        padding: '0.75rem',
        marginBottom: '1rem',
        borderRadius: '4px',
        color: '#000'
    },
    storedFileBox: {
        padding: '1rem',
        marginBottom: '1rem',
        backgroundColor: '#fffbe6',
        borderRadius: '4px',
        border: '1px solid #ffe08a',
        color: '#333'
    },
    storedFileTitle: {
        margin: '0 0 0.5rem 0',
        fontSize: '1.1rem',
        fontWeight: 'bold'
    },
    storedFileDetails: {
        fontSize: '0.9rem',
        borderLeft: '3px solid #ffcc00',
        paddingLeft: '10px'
    },
    buttonGroup: {
        display: 'flex',
        gap: '1rem',
        marginTop: '1.5rem'
    },
    uploadButton: (file: File | null, uploading: boolean) => ({
        flex: 1,
        padding: '0.75rem 1.5rem',
        backgroundColor: uploading || !file ? '#adb5bd' : '#007bff',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        fontSize: '1rem',
        fontWeight: '500',
        cursor: uploading || !file ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.2s'
    }),
    resetButton: {
        padding: '0.75rem 1.5rem',
        backgroundColor: '#dc3545',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        fontSize: '1rem',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'background-color 0.2s'
    }
};