import {describe, it, expect} from "vitest";
import {parsePath} from "../utils.js";

describe("parsePath", () => {
  describe("valid paths", () => {
    it("parses a well-formed original.pdf path", () => {
      const result = parsePath("workspaces/ws-123/files/file-456/original.pdf");
      expect(result).toEqual({workspaceId: "ws-123", fileId: "file-456"});
    });

    it("handles workspace and file IDs with hyphens and numbers", () => {
      const result = parsePath("workspaces/my-workspace-1/files/abc-def-123/original.pdf");
      expect(result).toEqual({workspaceId: "my-workspace-1", fileId: "abc-def-123"});
    });

    it("accepts uppercase PDF extension (case-insensitive)", () => {
      const result = parsePath("workspaces/ws/files/f/DOCUMENT.PDF");
      expect(result).toEqual({workspaceId: "ws", fileId: "f"});
    });

    it("accepts a PDF with a different filename (not just original.pdf)", () => {
      const result = parsePath("workspaces/ws/files/f/report.pdf");
      expect(result).toEqual({workspaceId: "ws", fileId: "f"});
    });
  });

  describe("invalid paths — wrong structure", () => {
    it("returns null for a path that is too short", () => {
      expect(parsePath("workspaces/ws/files/f")).toBeNull();
    });

    it("returns null for an empty string", () => {
      expect(parsePath("")).toBeNull();
    });

    it("returns null when root segment is not 'workspaces'", () => {
      expect(parsePath("buckets/ws-123/files/file-456/original.pdf")).toBeNull();
    });

    it("returns null when third segment is not 'files'", () => {
      expect(parsePath("workspaces/ws-123/documents/file-456/original.pdf")).toBeNull();
    });
  });

  describe("invalid paths — wrong file type", () => {
    it("returns null for a .txt file", () => {
      expect(parsePath("workspaces/ws/files/f/document.txt")).toBeNull();
    });

    it("returns null for a .png file", () => {
      expect(parsePath("workspaces/ws/files/f/image.png")).toBeNull();
    });

    it("returns null for a path with no file extension", () => {
      expect(parsePath("workspaces/ws/files/f/original")).toBeNull();
    });
  });

  describe("invalid paths — derived/generated files to skip", () => {
    it("returns null for a preview file", () => {
      expect(parsePath("workspaces/ws/files/f/preview.pdf")).toBeNull();
    });

    it("returns null for a thumbnail file", () => {
      expect(parsePath("workspaces/ws/files/f/thumbnail.pdf")).toBeNull();
    });

    it("returns null for an export file", () => {
      expect(parsePath("workspaces/ws/files/f/export.pdf")).toBeNull();
    });

    it("returns null when 'preview' appears in a subdirectory name", () => {
      expect(parsePath("workspaces/ws/files/f/previews/page1.pdf")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles leading slashes gracefully", () => {
      const result = parsePath("/workspaces/ws-1/files/f-1/original.pdf");
      expect(result).toEqual({workspaceId: "ws-1", fileId: "f-1"});
    });

    it("handles trailing slashes (folder path) as null", () => {
      expect(parsePath("workspaces/ws/files/f/")).toBeNull();
    });
  });
});
