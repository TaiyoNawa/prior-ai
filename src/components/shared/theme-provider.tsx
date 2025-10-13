"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";

import type { ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // テーマ切り替え（ライト/ダーク）を提供
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      {...props}
    >
      {children}
    </NextThemeProvider>
  );
}
