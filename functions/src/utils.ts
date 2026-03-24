/**
 * Parses a Firebase Storage object path into workspaceId and fileId.
 * Expected pattern: workspaces/{workspaceId}/files/{fileId}/original.pdf
 * Returns null for any path that should not trigger ingestion.
 */
export function parsePath(name: string): {workspaceId: string; fileId: string} | null {
  const parts = name.split("/").filter(Boolean);

  if (parts.length < 5) return null;
  if (parts[0] !== "workspaces") return null;
  if (parts[2] !== "files") return null;

  const workspaceId = parts[1];
  const fileId = parts[3];
  const filename = parts.slice(4).join("/").toLowerCase();

  if (!filename.endsWith(".pdf")) return null;

  if (
    filename.includes("preview") ||
    filename.includes("thumbnail") ||
    filename.includes("export")
  ) {
    return null;
  }

  return {workspaceId, fileId};
}
