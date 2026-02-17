"use client";

import { auth } from "@/lib/firebase/firebase";
import {
  onAuthStateChanged,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  linkWithPopup,
  signOut,
  type User,
  type AuthProvider as FirebaseAuthProvider
} from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGithub: () => Promise<void>;
  linkAccount: (provider: FirebaseAuthProvider) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async (email?: string) => {
    if (email) {
      const methods = await fetchSignInMethodsForEmail(auth, email);

      if (methods.length > 0 && !methods.includes("google.com")) {
        alert(`An account with this email already exists with ${methods[0]}. Please sign in first, then link your Google account in your settings.`);
        return;
      }
    }

    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithGithub = async () => {
    const provider = new GithubAuthProvider();
    await signInWithPopup(auth, provider);
  }

  const linkAccount = async (provider: FirebaseAuthProvider) => {
    if (!auth.currentUser) throw new Error("No user to link account to.");

    try {
      await linkWithPopup(auth.currentUser, provider);
    } catch (error: any) {
      if (error.code === "auth/credential-already-in-use") {
        alert("This account is already linked with another user.");
      } else {
        console.error("Error linking accounts: ", error);
        throw error;
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      signup, 
      loginWithGoogle, 
      loginWithGithub, 
      linkAccount,
      logout  
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
