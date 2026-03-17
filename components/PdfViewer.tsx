"use client";

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

// annotations support
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
}

export default function PdfViewer({url}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  const [containerWidth, setContainerWidth] = useState<number>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setContainerWidth(width - 32);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // triggered when PDF successfully fetches and parses
  function onDocumentLoadSuccess({numPages}: {numPages: number}) {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full w-full items-center bg-muted/10 border overflow-hidden">

      {/* Page Controls */}
      <div className="flex items-center justify-between w-full p-2 bg-background border-b shadow-sm z-10">
        <Button
          variant="ghost"
          size="sm"
          disabled={pageNumber <= 1 || loading}
          onClick={() => setPageNumber((prev) => prev - 1)}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Prev
        </Button>

        <span className="text-sm font-medium text-muted-foreground">
          {numPages ? `Page ${pageNumber} of ${numPages}` : "Loading..."}
        </span>

        <Button
          variant="ghost"
          size="sm"
          disabled={pageNumber >= (numPages || 1) || loading}
          onClick={() => setPageNumber((prev) => prev + 1)}
        >
          Next <ChevronRight className="w-4 h-4 mr-1" />
        </Button>
      </div>

      {/* Document Viewer */}
      <div 
        ref={containerRef}
        className="flex-1 w-full overflow-y-auto overflow-x-hidden flex justify-center p-4">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex flex-col items-center justify-center mt-20 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
              <p>Loading document...</p>
            </div>
          }
          error={
            <div className="text-red-500 mt-20 text-center">
              <p>Failed to load PDF.</p>
              <p className="text-xs mt-2 text-muted-foreground">Check your Firebase CORS rules!</p>
            </div>
          }
        >
          {/* Render */}
          <Page
            pageNumber={pageNumber}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-md rounded-sm border"
            width={containerWidth}
          />
        </Document>
      </div>
    </div>
  );
}

