import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Cal_Sans } from "next/font/google";
import "./globals.css";

// Wrapped the entire app with AuthProvider so any page can call useAuth().

import { AuthProvider } from "@/components/Auth";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const calSans = Cal_Sans({
  variable: "--font-cal-sans",
  subsets: ["latin"],
  weight: "400"
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Miaomo — AI-Powered Document Intelligence",
  description: "Upload, understand, and learn from any document with intelligent AI assistance. Chat with your files, generate quizzes, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body
        className={`${geistSans.variable} ${calSans.variable} ${geistMono.variable} antialiased`}
      >
        {/*Wrapped the app so auth context is available everywhere */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
