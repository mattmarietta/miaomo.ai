"use client";

import DashboardCard from "@/components/dashboard/DashboardCard";

type DashboardGridProps = {
  onUploadClick: () => void;
  onWorkspaceClick: () => void;
};

export default function DashboardGrid({ onUploadClick, onWorkspaceClick }: DashboardGridProps) {
  return (
    <section className="max-w-5xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      <DashboardCard title="Upload a document">
        <p className="text-sm text-zinc-400 mt-1">TODO: connect to Firebase Storage.</p>
        <button
          className="mt-4 w-full border border-zinc-700 rounded-xl px-4 py-2 hover:bg-zinc-900"
          onClick={onUploadClick}
        >
          Upload
        </button>
      </DashboardCard>

      <DashboardCard title="Recent documents">
        <p className="text-sm text-zinc-400 mt-1">TODO: load from Firestore.</p>
        <p className="text-sm text-zinc-500 mt-4">No documents yet.</p>
      </DashboardCard>

      <DashboardCard title="Workspace">
        <p className="text-sm text-zinc-400 mt-1">TODO: chat with docs + annotations.</p>
        <button
          className="mt-4 w-full border border-zinc-700 rounded-xl px-4 py-2 hover:bg-zinc-900"
          onClick={onWorkspaceClick}
        >
          Open workspace
        </button>
      </DashboardCard>
    </section>
  );
}
