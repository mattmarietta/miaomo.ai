"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Auth context (Firebase auth wrapper)
import { useAuth } from "@/components/Auth";

export default function DashboardPage() {
    const router = useRouter();

    // Auth state
    // It'll be null if the user isn't logged in
    const { user, loading, logout } = useAuth();

    // If not logged in, send user to /login
    useEffect(() => {
        if (loading) return;
        if (!user) router.replace("/login");
    }, [loading, user, router]);

    // Loading state while Firebase checks auth
    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <p>Loading…</p>
            </main>
        );
    }

    // If user is missing, we redirect
    if (!user) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <p>Redirecting…</p>
            </main>
        );
    }

    // Go to chatbox 1.0 / workspace
    const handleWorkspace = async () => {
        router.replace("/workspace");
    };

    // Logout handler
    const handleLogout = async () => {
        await logout();
        router.replace("/login");
    };

    /*
    What needs to be finished 
    1) Add upload UI and connect to Firebase Storage
    2) Save uploaded docs in Firestore
    3) Show recent documents for this user
    4) Add Workspace page (chat + annotations)
  */

    return (
        <main className="min-h-screen bg-black text-white p-6">
            {/* Header */}
            <header className="max-w-5xl mx-auto flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Miaomo Dashboard</h1>
                    <p className="text-sm text-zinc-400">Signed in as: {user.email}</p>
                </div>

                <button
                    className="border border-zinc-700 rounded-xl px-4 py-2 bg-zinc-950 hover:bg-zinc-900"
                    onClick={handleLogout}
                >
                    Log out
                </button>
            </header>

            {/* Content */}
            <section className="max-w-5xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Upload (placeholder) */}
                <div className="border border-zinc-800 rounded-2xl p-4 bg-zinc-950">
                    <h2 className="font-semibold">Upload a document</h2>
                    <p className="text-sm text-zinc-400 mt-1">TODO: connect to Firebase Storage.</p>
                    <button
                        className="mt-4 w-full border border-zinc-700 rounded-xl px-4 py-2 hover:bg-zinc-900"
                        onClick={() => alert("Upload hasn't been uploaded yet.")}
                    >
                        Upload
                    </button>
                </div>

                {/* Recent documents (placeholder) */}
                <div className="border border-zinc-800 rounded-2xl p-4 bg-zinc-950">
                    <h2 className="font-semibold">Recent documents</h2>
                    <p className="text-sm text-zinc-400 mt-1">TODO: load from Firestore.</p>
                    <p className="text-sm text-zinc-500 mt-4">No documents yet.</p>
                </div>

                {/* Workspace (placeholder) */}
                <div className="border border-zinc-800 rounded-2xl p-4 bg-zinc-950">
                    <h2 className="font-semibold">Workspace</h2>
                    <p className="text-sm text-zinc-400 mt-1">TODO: chat with docs + annotations.</p>
                    <button
                        className="mt-4 w-full border border-zinc-700 rounded-xl px-4 py-2 hover:bg-zinc-900"
                        onClick={handleWorkspace}
                    >
                        Open workspace
                    </button>
                </div>
            </section>
        </main>
    );
}
