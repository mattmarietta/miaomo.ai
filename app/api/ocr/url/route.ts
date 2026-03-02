import { NextResponse } from "next/server";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";

export const runtime = "nodejs";
export const maxDuration = 60;

function getDocAiClient() {
    const location = process.env.DOC_AI_LOCATION!;
    const apiEndpoint = `${location}-documentai.googleapis.com`;

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail) throw new Error("Missing GOOGLE_CLIENT_EMAIL");
    if (!privateKey) throw new Error("Missing GOOGLE_PRIVATE_KEY");

    //remove wrapping quotes
    privateKey = privateKey.replace(/^"|"$/g, "").replace(/^'|'$/g, "");

    //convert literal \n into actual newlines
    privateKey = privateKey.replace(/\\n/g, "\n");

    return new DocumentProcessorServiceClient({ 
        apiEndpoint, 
        credentials: { 
            client_email: clientEmail,
            private_key: privateKey, 
        },
    });
}

export async function POST(req: Request) {
    try {
        const { url, mimeType } = await req.json();

        if (!url || !mimeType) {
            return NextResponse.json(
                { error: "Missing 'url' or 'mimeType' in request body" },
                { status: 400 }
            );
        }

        const SUPPORTED_MIME_TYPES = [
            "application/pdf",
            "image/tiff",
            "image/tif",
            "image/gif",
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/bmp",
            "image/webp",
        ];

        if (!SUPPORTED_MIME_TYPES.includes(mimeType.toLowerCase())) {
            return NextResponse.json(
                { error: `Unsupported mimeType: ${mimeType}` },
                { status: 400 }
            );
        }

        //download file using firebase storage url
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`Failed to fetch file from storage: ${resp.status} ${resp.statusText}`);
        }
        const bytes = Buffer.from(await resp.arrayBuffer());

        const projectId = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_ID!;
        const location = process.env.DOC_AI_LOCATION!;
        const processorId = process.env.DOC_AI_PROCESSOR_ID!;
        const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

        const client = getDocAiClient();
        const [result] = await client.processDocument({
                name,
                rawDocument: { content: bytes, mimeType },
        });

        const doc = result.document;
        const fullText = doc?.text ?? "";

        const pages =
            doc?.pages?.map((p, i) => ({
            pageNumber: i + 1,
            words:
                p.tokens?.map((t) => {
                const segments = t.layout?.textAnchor?.textSegments ?? [];
                const text = segments
                    .map((s) =>
                    fullText.substring(
                        Number(s.startIndex ?? 0),
                        Number(s.endIndex ?? 0)
                    )
                    )
                    .join("");

                const nv = t.layout?.boundingPoly?.normalizedVertices ?? [];
                const poly = nv.map((v) => ({ x: v.x ?? 0, y: v.y ?? 0 }));

                return { text, poly };
                }) ?? [],
            })) ?? [];

        return NextResponse.json({ fullText, pages });
    }catch (e: any) {
        console.error(e);
        return NextResponse.json(
        { error: "OCR failed", details: e?.message ?? String(e) },
        { status: 500 }
        );
    }
}