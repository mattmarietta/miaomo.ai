"use client";

import { useAuth } from "@/components/Auth";
import { Button } from "@/components/ui/button";
import SocialLinks from "@/components/SocialLinks";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const { logout } = useAuth();
    const router = useRouter();

    return (
        <main className="p-8 max-w-2xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold">Account Settings</h1>
            <SocialLinks />
            <div className="pt-4 border-t">
                <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={async () => {
                        await logout();
                        router.push("/");
                    }}
                >
                    <LogOut className="size-4" />
                    Log out
                </Button>
            </div>
        </main>
    );
}