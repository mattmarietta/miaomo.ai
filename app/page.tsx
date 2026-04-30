"use client";

import { AuthForm } from "@/components/landing/AuthForm";
import { FeatureShowcase } from "@/components/landing/FeatureShowcase";

export default function LandingPage() {
  return (
    <main className="flex h-dvh flex-col lg:flex-row">
      <div className="flex w-full shrink-0 items-center justify-center px-6 py-12 lg:w-[480px] lg:px-12">
        <AuthForm />
      </div>
      <div className="hidden flex-1 lg:flex">
        <FeatureShowcase />
      </div>
    </main>
  );
}
