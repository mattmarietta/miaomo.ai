"use client"
import { useAuth } from "@/components/Auth"
import {
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar"
import { subscribeChatsByUserId } from "@/lib/firebase/chatStore"
import { DBChatSchema } from "@/lib/firebase/schema"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

export const AppSidebarChatList = () => {

  const [chats, setChats] = useState<DBChatSchema[]>([])

  const { user, loading } = useAuth()
  useEffect(() => {
    if (!user || loading) return
    const unsubscribe = subscribeChatsByUserId(
      user.uid,
      setChats,
      () => setChats([]),
    )
    return () => unsubscribe()
  }, [user, loading])

  if (chats.length == 0) {
    return <SidebarMenuItem>
      <SidebarMenuButton asChild className="gap-1 pl-2">
        <Link href={"/chat"} className="font-medium  text-muted-foreground ">
          <Plus />
          Create Chat
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  }
  return (
    <>
      {chats.map((chat) => (
        <ChatListItem key={chat.id} title={chat.title ?? "Untitled"} href={`/workspace/${chat.id}`} />
      ))}
    </>
  )
}


const ChatListItem = ({ title, href }: { title: string, href: string }) => {
  return <SidebarMenuItem>
    <SidebarMenuButton asChild>
      <Link href={href} className="font-medium">
        {title}
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
}