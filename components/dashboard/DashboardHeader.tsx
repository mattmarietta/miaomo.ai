"use client";

type DashboardHeaderProps = {
  email: string | null;
  onLogout: () => void;
};

export default function DashboardHeader({ email, onLogout }: DashboardHeaderProps) {
  return (
    <header className="max-w-5xl mx-auto flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Miaomo Dashboard</h1>
        <p className="text-sm text-zinc-400">Signed in as: {email ?? "Unknown"}</p>
      </div>

      <button
        className="border border-zinc-700 rounded-xl px-4 py-2 bg-zinc-950 hover:bg-zinc-900"
        onClick={onLogout}
      >
        Log out
      </button>
    </header>
  );
}
