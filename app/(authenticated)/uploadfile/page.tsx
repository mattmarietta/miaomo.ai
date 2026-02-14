"use client"

import FileUploadForm  from "@/components/FileUpload";

export default function UploadFilePage() {
    return (
        <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'Arial, sans-serif' }}>
            <h1 style={{ textAlign: 'center' }}>Upload a File</h1>
            <FileUploadForm />
        </div>
    );
}
