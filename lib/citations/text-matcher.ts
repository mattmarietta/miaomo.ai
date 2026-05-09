function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function findTextMatch(
  pageText: string,
  chunkText: string,
): { start: number; end: number } | null {
  if (!pageText || !chunkText) return null;

  // Exact match
  const exactIdx = pageText.indexOf(chunkText);
  if (exactIdx >= 0) {
    return { start: exactIdx, end: exactIdx + chunkText.length };
  }

  // Normalized match
  const normPage = normalize(pageText);
  const normChunk = normalize(chunkText);
  const normIdx = normPage.indexOf(normChunk);
  if (normIdx >= 0) {
    return { start: normIdx, end: normIdx + normChunk.length };
  }

  // Partial match: try first 100 chars of chunk
  const partial = normChunk.slice(0, 100);
  if (partial.length > 20) {
    const partialIdx = normPage.indexOf(partial);
    if (partialIdx >= 0) {
      return { start: partialIdx, end: partialIdx + partial.length };
    }
  }

  return null;
}

export async function findPageForText(
  pdfUrl: string,
  chunkText: string,
  totalPages: number,
): Promise<number | null> {
  // This is a placeholder — actual implementation would use pdfjs to
  // extract text per page and match. For now, return null to trigger
  // the fallback behavior (open page 1).
  return null;
}
