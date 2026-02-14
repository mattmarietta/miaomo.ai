"use client"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { CatIcon, ChevronDown, ChevronRight, Home, Layout, LayoutDashboard, Library, LibraryBigIcon, PawPrintIcon, User2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function AppSidebar() {
  const chats = [{ id: "alskfjalksfj", title: "What is r-22", createdAt: new Date() }]
  const pathname = usePathname()

  return (
    <Sidebar className="" variant="inset">
      <SidebarRail />

      <SidebarHeader className="">
        <div className="flex gap-1 items-center px-1">
          <CatIcon className="size-5" /><h1 className="text-lg  font-cal-sans text-zinc-900  ">Miaomo</h1>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname == "/dashboard"}>
              <Link href="/dashboard">
                <LayoutDashboard className="size-5 " />
                <span className="text-sm font-medium">
                  Dashboard
                </span>
              </Link>
            </SidebarMenuButton>

          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname == "/library"}>
              <Link href="/library">
                <LayoutDashboard className="size-5 " />
                <span className="text-sm font-medium">
                  Library
                </span>
              </Link>
            </SidebarMenuButton>

          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="bg-white">


        <Collapsible title="Chats" defaultOpen>
          <SidebarGroup>

            <SidebarGroupLabel asChild className="group/label hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"

            >
              <CollapsibleTrigger>
                Chats
                <ChevronRight className="size-4 ml-auto transition-transform group-data-panel-open/label:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <ChatListItem title="What is r-22" href="/" />
                  <ChatListItem title="What is r-22" href="/" />
                  <ChatListItem title="What is r-22" href="/" />
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
      <SidebarFooter>
      </SidebarFooter>
    </Sidebar >
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