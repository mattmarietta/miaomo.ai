"use client";
import { useAuth } from "@/components/Auth";
import { AppSidebarWorkspaceList } from "@/components/sidebar/AppSidebarWorkspaceList";
import { AppSidebarWorkspaceView } from "@/components/sidebar/AppSidebarWorkspaceView";
import { AppSidebarHeader } from "@/components/sidebar/AppSidebarHeader";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ChevronRight, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  // Extract workspace ID from path like /workspace/abc123 or /workspace/abc123/chat/xyz
  const workspaceMatch = pathname.match(/^\/workspace\/([^/]+)/);
  const activeWorkspaceId = workspaceMatch?.[1];

  return (
    <Sidebar className="" variant="inset">
      <SidebarRail />

      {!activeWorkspaceId && <AppSidebarHeader pathname={pathname} />}
      <SidebarContent className="bg-white">
        {activeWorkspaceId ? (
          // Inside a workspace — show only this workspace's files & chats
          <AppSidebarWorkspaceView workspaceId={activeWorkspaceId} />
        ) : (
          // Dashboard / other pages — show workspace list
          <Collapsible title="Workspaces" defaultOpen>
            <SidebarGroup>
              <SidebarGroupLabel
                asChild
                className="group/label text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
              >
                <CollapsibleTrigger className={""}>
                  Workspaces
                  <ChevronRight className="size-4 ml-auto transition-transform group-data-panel-open/label:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <AppSidebarWorkspaceList />
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
      </SidebarContent>
      <SidebarFooter className="bg-white">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="gap-2"
              onClick={() => router.push("/account-settings")}
            >
              <Settings className="size-4" />
              <span className="text-sm font-medium">
                {user?.displayName || user?.email || "Settings"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
