import { ChatHeader } from "@/components/chat/ChatHeader";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider className="max-h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="sm:shadow-none ">
        <ChatHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
