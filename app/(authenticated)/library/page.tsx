"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/Auth"
import { useRouter } from "next/navigation"
import {
  subscribeWorkspacesByUserId,
  subscribeWorkspaceFiles,
} from "@/lib/firebase/client-queries"
import { DBWorkspaceSchema, DBWorkspaceFileSchema } from "@/lib/firebase/schema"
import { FileText, Image, FileSpreadsheet, File } from "lucide-react"

type FileWithWorkspace = DBWorkspaceFileSchema & { workspaceTitle: string; workspaceId: string }

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith("image/")) return Image
  if (mimeType === "application/pdf") return FileText
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("csv")) return FileSpreadsheet
  return File
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(timestamp: any) {
  if (!timestamp) return ""
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function LibraryPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<DBWorkspaceSchema[]>([])
  const [allFiles, setAllFiles] = useState<FileWithWorkspace[]>([])

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace("/login"); return }
    const unsub = subscribeWorkspacesByUserId(user.uid, setWorkspaces)
    return () => unsub()
  }, [loading, user, router])

  useEffect(() => {
    if (workspaces.length === 0 || !user) { setAllFiles([]); return }

    const unsubs: (() => void)[] = []
    const filesMap = new Map<string, FileWithWorkspace[]>()

    for (const ws of workspaces) {
      const unsub = subscribeWorkspaceFiles(ws.id, user.uid, (files) => {
        filesMap.set(ws.id, files.map((f) => ({ ...f, workspaceTitle: ws.title || "Untitled", workspaceId: ws.id })))
        const merged = Array.from(filesMap.values()).flat()
        merged.sort((a, b) => {
          const aTime = (a.createdAt as any)?.toMillis?.() ?? 0
          const bTime = (b.createdAt as any)?.toMillis?.() ?? 0
          return bTime - aTime
        })
        setAllFiles(merged)
      })
      unsubs.push(unsub)
    }

    return () => unsubs.forEach((u) => u())
  }, [workspaces])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting...</p>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All files across your workspaces
          </p>
        </div>

        {allFiles.length === 0 ? (
          <div className="text-center py-12">
            <File className="size-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No files uploaded yet.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Workspace</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Size</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {allFiles.map((file) => {
                  const Icon = getFileIcon(file.mimeType)
                  return (
                    <tr
                      key={file.id}
                      className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/workspace/${file.workspaceId}?file=${encodeURIComponent(file.id)}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium">{file.originalName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        <span className="truncate">{file.workspaceTitle}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {formatSize(file.size)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {formatDate(file.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
