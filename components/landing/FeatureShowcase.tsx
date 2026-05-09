import { MessageSquare, Search, BookOpen, Sparkles } from "lucide-react";
import { FeatureCard } from "./FeatureCard";

const features = [
  {
    icon: <MessageSquare size={20} className="text-white" />,
    title: "AI Document Chat",
    description:
      "Chat with your documents using multiple AI models. Get instant answers grounded in your content.",
  },
  {
    icon: <Search size={20} className="text-white" />,
    title: "Smart Search",
    description:
      "Semantic search powered by vector embeddings. Find exactly what you need across all your documents.",
  },
  {
    icon: <BookOpen size={20} className="text-white" />,
    title: "Quiz & Flashcards",
    description:
      "Auto-generate quizzes and flashcards from your materials. Study smarter with spaced repetition.",
  },
  {
    icon: <Sparkles size={20} className="text-white" />,
    title: "Multi-Model AI",
    description:
      "Choose from Claude, Gemini, GPT-4o, and more. Pick the best model for every task.",
  },
];

export function FeatureShowcase() {
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-l-3xl p-12"
      style={{
        background: `linear-gradient(
          135deg,
          oklch(0.30 0.08 200) 0%,
          oklch(0.25 0.10 180) 25%,
          oklch(0.22 0.12 163) 50%,
          oklch(0.28 0.08 145) 75%,
          oklch(0.32 0.06 130) 100%
        )`,
      }}
    >
      {/* Glow orbs */}
      <div
        className="absolute -top-24 -right-24 size-96 rounded-full opacity-20 blur-3xl"
        style={{ background: "oklch(0.60 0.13 163)" }}
      />
      <div
        className="absolute -bottom-32 -left-32 size-80 rounded-full opacity-15 blur-3xl"
        style={{ background: "oklch(0.70 0.15 130)" }}
      />

      <div className="relative z-10 w-full max-w-lg">
        <h2 className="font-[family-name:var(--font-cal-sans)] text-3xl text-white mb-2">
          Your documents, supercharged with AI
        </h2>
        <p className="text-base text-white/60 mb-10">
          Upload, understand, and learn from any document with intelligent AI
          assistance.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </div>
  );
}
