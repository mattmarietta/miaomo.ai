import type { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-white/10">
        {icon}
      </div>
      <h3 className="mb-1 text-base font-medium text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-white/70">{description}</p>
    </div>
  );
}
