import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";

import { ThemeProvider } from "@/components/layout/theme-provider";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

// The theme asks for Inter / Source Serif 4 / JetBrains Mono; globals.css maps
// these variables onto --font-sans / --font-serif / --font-mono.
const inter = Inter({ variable: "--font-inter-loaded", subsets: ["latin"] });
const sourceSerif = Source_Serif_4({
  variable: "--font-serif-loaded",
  subsets: ["latin"],
});
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono-loaded",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Follow-up & Execution Manager",
  description: "Who owes me what, and when do I chase them again?",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Follow-ups",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

/**
 * Deliberately free of the sidebar and of any database access: /login renders
 * through this layout too, and must work while signed out. The app shell lives
 * in app/(app)/layout.tsx.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // next-themes writes the class/style here before paint.
      suppressHydrationWarning
      className={`${inter.variable} ${sourceSerif.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground">
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster position="bottom-right" richColors />
            <ServiceWorkerRegistrar />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
