"use client";

type DashboardCardProps = {
  title: string;
  children: React.ReactNode;
};

export default function DashboardCard({ title, children }: DashboardCardProps) {
  return (
    <div className="border border-zinc-800 rounded-2xl p-4 bg-zinc-950">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-2">{children}</div>
    </div>
  );
}
