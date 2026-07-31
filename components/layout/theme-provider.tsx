"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * The theme ships light and dark palettes keyed off a `.dark` class, so
 * next-themes drives it with attribute="class".
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
