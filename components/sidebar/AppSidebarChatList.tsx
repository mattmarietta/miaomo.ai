"use client"
import {
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar"
import Link from "next/link"

export const AppSidebarChatList = () => {
  return (
    <>
      <ChatListItem title="What is r-22" href="/" />
      <ChatListItem title="What is r-22" href="/" />
      <ChatListItem title="What is r-22" href="/" />
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