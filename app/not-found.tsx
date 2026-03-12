import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background">
      <h2 className="text-2xl font-semibold">404 — Not Found</h2>
      <p className="text-muted-foreground">Could not find the requested page.</p>
      <Link href="/" className="text-primary underline underline-offset-4">
        Return Home
      </Link>
    </div>
  );
}

