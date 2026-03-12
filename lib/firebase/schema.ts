import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const userMessageSchema = z.object({
  id: z.uuid(),
  role: z.enum(["user"]),
  parts: z.array(partSchema),
});

// For tool approval flows, we accept all messages (more permissive schema)
export const messageSchema = z.object({
  id: z.string(),
  role: z.string(),
  parts: z.array(z.any()),
});

export const chatSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  title: z.string().nullable(),
  userId: z.string(),
});

export type DBChatSchema = z.infer<typeof chatSchema>;

export const dbMessageSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(z.any()),
  metadata: z.any().optional(),
  attachments: z.array(z.any()).optional(),
});

export type DBMessageSchema = z.infer<typeof dbMessageSchema>;

export const workspaceSchema = z.object({
  id: z.string(),
  title: z.string(),
  ownerUid: z.string(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

export type DBWorkspaceSchema = z.infer<typeof workspaceSchema>;

export const workspaceFileSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  status: z.string(),
  storagePath: z.string(),
  downloadUrl: z.string().optional(),
  ownerUid: z.string(),
  workspaceID: z.string(),
  fileId: z.string().optional(),
  generation: z.string().optional(),
  chunkCount: z.number().optional(),
  vectorCount: z.number().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

export type DBWorkspaceFileSchema = z.infer<typeof workspaceFileSchema>;

