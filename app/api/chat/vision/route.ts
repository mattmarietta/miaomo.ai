// app/api/vision/route.ts
import { NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";

function getVisionClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON missing in env");
  let creds;
  try { creds = JSON.parse(raw); } catch { throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_JSON"); }
  console.log("Vision creds loaded for:", creds.project_id || process.env.GCLOUD_PROJECT_ID, creds.client_email);
  return new ImageAnnotatorClient({
    credentials: { client_email: creds.client_email, private_key: creds.private_key },
    projectId: creds.project_id || process.env.GCLOUD_PROJECT_ID,
  });
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1" || req.headers.get("accept")?.includes("application/json");
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    console.log("Received files count:", files.length);
    if (!files.length) return NextResponse.json({ error: "No files uploaded" }, { status: 400 });

    const vision = getVisionClient();

    // Debug: return OCR text JSON when ?debug=1 or Accept: application/json
    const results: Array<{ filename: string; textSnippet: string; fullTextLength: number }> = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const [result] = await vision.documentTextDetection({ image: { content: buffer }});
      const fullText = result.fullTextAnnotation?.text || "";
      results.push({ filename: (file as any).name || "upload", textSnippet: fullText.slice(0, 2000), fullTextLength: fullText.length });
    }

    if (debug) {
      return NextResponse.json({ ok: true, results }, { status: 200 });
    }

    // Otherwise build a simple PDF (image + invisible text)
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const [result] = await vision.documentTextDetection({ image: { content: buffer }});
      const text = result.fullTextAnnotation?.text || "";

      let img;
      try { img = await pdfDoc.embedPng(buffer); } catch { img = await pdfDoc.embedJpg(buffer); }
      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });

      page.drawText(text, { x: 5, y: 5, size: 8, font, color: rgb(1,1,1) });
    }

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="vision-output.pdf"',
      },
    });
  } catch (err: any) {
    console.error("Vision route error:", err);
    return NextResponse.json({ error: err?.message || "Vision processing failed" }, { status: 500 });
  }
}
