import { ImageAnnotatorClient } from "@google-cloud/vision";

function getVisionClient() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!raw || !raw.trim().startsWith("{")) {
    return new ImageAnnotatorClient();
  }

  let creds;
  try {
    creds = JSON.parse(raw);
  } catch {
    throw new Error("Google credentials env var is not valid JSON");
  }

  return new ImageAnnotatorClient({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
    projectId: creds.project_id || process.env.GCLOUD_PROJECT_ID,
  });
}

export async function ocrImage(buffer: Buffer): Promise<string> {
  const vision = getVisionClient();
  const [result] = await vision.documentTextDetection({ image: { content: buffer } });
  return result.fullTextAnnotation?.text || "";
}

// OCR a scanned PDF. Vision's sync API only lets us send 5 pages at a time,
export async function ocrPdf(buffer: Buffer, maxPages: number = 20): Promise<string> {
  const vision = getVisionClient();
  const content = buffer.toString("base64");
  const allText: string[] = [];

  // We only touch one field on each page response, so a tiny local type is enough.
  type VisionPageResponse = {
    fullTextAnnotation?: { text?: string | null } | null;
  };

  for (let start = 1; start <= maxPages; start += 5) {
    const pages: number[] = [];
    for (let p = start; p <= Math.min(start + 4, maxPages); p++) pages.push(p);

    let pageResponses: VisionPageResponse[] = [];
    try {
      const [response] = await vision.batchAnnotateFiles({
        requests: [
          {
            inputConfig: { content, mimeType: "application/pdf" },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            pages,
          },
        ],
      });
      pageResponses = response.responses?.[0]?.responses || [];
    } catch {
      // Usually means we asked past the last page of the PDF. 
      break;
    }

    for (const page of pageResponses) {
      if (page.fullTextAnnotation?.text) {
        allText.push(page.fullTextAnnotation.text);
      }
    }

    // Fewer pages came back than we asked 
    if (pageResponses.length < pages.length) break;
  }

  return allText.join("\n\n");
}
