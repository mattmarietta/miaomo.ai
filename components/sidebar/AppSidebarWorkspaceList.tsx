"use client"
import { useAuth } from "@/components/Auth"
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  subscribeWorkspacesByUserId,
  createWorkspace,
} from "@/lib/firebase/client-queries"
import { DBWorkspaceSchema } from "@/lib/firebase/schema"
import { Plus, FolderOpen } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export const AppSidebarWorkspaceList = () => {
  const [workspaces, setWorkspaces] = useState<DBWorkspaceSchema[]>([])
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user || loading) return
    const unsubscribe = subscribeWorkspacesByUserId(
      user.uid,
      setWorkspaces,
      (err) => {
        console.error("Failed to load workspaces:", err)
        setWorkspaces([])
      },
    )
    return () => unsubscribe()
  }, [user, loading])

  const handleCreateWorkspace = async () => {
    if (!user) return
    const id = await createWorkspace(user.uid, "Untitled Workspace")
    router.push(`/workspace/${id}`)
  }

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={handleCreateWorkspace} className="gap-1 pl-2">
          <Plus className="size-4" />
          <span className="font-medium text-muted-foreground">New Workspace</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {workspaces.map((ws) => (
        <WorkspaceItem key={ws.id} workspace={ws} />
      ))}
    </>
  )
}

const WorkspaceItem = ({ workspace }: { workspace: DBWorkspaceSchema }) => {
  const pathname = usePathname()
  const isActive = pathname.startsWith(`/workspace/${workspace.id}`)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="gap-2 font-medium"
        isActive={isActive}
        asChild
      >
        <Link href={`/workspace/${workspace.id}`}>
          <FolderOpen className="size-4 shrink-0" />
          <span className="truncate">{workspace.title || "Untitled"}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
