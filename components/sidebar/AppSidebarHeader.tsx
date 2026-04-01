"use client"
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar"
import { CatIcon, LayoutDashboard, Library } from "lucide-react"
import Link from "next/link"

export const AppSidebarHeader = ({ pathname }: { pathname: string }) => {
  return (
    <SidebarHeader className="">
      <div className="flex gap-1 items-center  px-1">
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
              <Library className="size-5 " />
              <span className="text-sm font-medium">
                Library
              </span>
            </Link>
          </SidebarMenuButton>

        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}

