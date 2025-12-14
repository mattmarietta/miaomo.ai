"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// This comes from your Auth context 
// If this import errors, it means components/Auth.tsx isn't set up yet.
import { useAuth } from "@/components/Auth";

export default function LoginPage() {
  // Next.js router for navigation 
  const router = useRouter();

  // Get auth info + functions from our Auth context
  const { user, loading, login, signup, loginWithGoogle } = useAuth();

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Toggle between login and signup mode
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Show any error messages to the user
  const [error, setError] = useState<string | null>(null);

  /*
    If the user is already logged in, we should not keep them on /login.
    Send them to /dashboard.
  */
  useEffect(() => {
    if (loading) return; // still checking auth
    if (user) router.replace("/dashboard");
}, [user, loading, router]);

  // Called when user clicks the main button
  const handleSubmit = async () => {
    setError(null);

    // Basic checks so we don't call Firebase with empty fields
    if (!email.trim()) {
      setError("Please enter an email.");
      return;
    }
    if (!password.trim()) {
      setError("Please enter a password.");
      return;
    }

    try {
      // If we're in login mode, the user can see sign in
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        // If we're in signup mode, the user can see create account
        await signup(email.trim(), password);
      }

      // After login/signup succeeds, go to dashboard
      router.replace("/dashboard");
    } catch (e) {
        if (e instanceof Error) {
            setError(e.message);
        } else {
            setError("Something went wrong.");
        }
    }

  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await loginWithGoogle();
      router.replace("/dashboard");
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("Google login failed.");
    }
  }

  // While Firebase checks whether the user is logged in
  if (loading) {
    return (
      <main className="h-screen flex items-center justify-center">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Miaomo</h1>

        <p className="text-sm text-zinc-500">
          {mode === "login" ? "Log in to continue" : "Create an account"}
        </p>

        {/* Email input */}
        <input
          className="w-full border rounded-xl p-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Password input */}
        <input
          className="w-full border rounded-xl p-3"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* Error message (only shows if error is not null) */}
        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        {/* Main action button */}
        <button
          className="w-full border rounded-xl p-3 bg-zinc-100"
          onClick={handleSubmit}
        >
          {mode === "login" ? "Log In" : "Sign Up"}
        </button>

        {/* Google Sign-in button*/}
        <button 
          className="w-full border rounded-xl p-3 bg-blue-500 text-white mt-2"
          onClick={handleGoogleLogin}>
        </button>

        {/* Switch between login and signup */}
        <button
          className="w-full text-sm underline"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
        </button>
      </div>
    </main>
  );
}
