"use client"
import { AppSidebarChatList } from "@/components/sidebar/AppSidebarChatList"
import { AppSidebarHeader } from "@/components/sidebar/AppSidebarHeader"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarRail
} from "@/components/ui/sidebar"
import { ChevronRight } from "lucide-react"
import { usePathname } from "next/navigation"

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar className="" variant="inset" >
      <SidebarRail />

      <AppSidebarHeader pathname={pathname} />
      <SidebarContent className="bg-white">


        <Collapsible title="Chats" defaultOpen>
          <SidebarGroup>

            <SidebarGroupLabel asChild className="group/label text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"

            >
              <CollapsibleTrigger className={""}>
                Chats
                <ChevronRight className="size-4 ml-auto transition-transform group-data-panel-open/label:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <AppSidebarChatList />
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



