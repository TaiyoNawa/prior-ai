import { Geist, Geist_Mono } from "next/font/google";

import { Header } from "@/components/header/Header";
import { Footer } from "@/components/shared/footer";
import { SupabaseProvider } from "@/components/shared/supabase-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import type { Metadata } from "next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PriorAI",
  description: "AIがタスクを優先順位づけする意思決定支援アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark" style={{ colorScheme: "dark" }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}
      >
        <ThemeProvider>
          <SupabaseProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1 bg-gradient-to-b from-background via-background to-muted/40">
                <div className="mx-auto w-full max-w-5xl px-6 py-10">
                  {children}
                </div>
              </main>
              <Footer />
            </div>
            <Toaster richColors position="top-center" />
          </SupabaseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
