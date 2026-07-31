"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { SidebarMenuButton } from "@/components/ui/sidebar";

/**
 * The icons swap via the `.dark` class rather than a mounted flag, so there is
 * nothing theme-dependent in the server-rendered markup to mismatch.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <SidebarMenuButton
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      tooltip="Toggle theme"
    >
      <SunIcon className="dark:hidden" />
      <MoonIcon className="hidden dark:block" />
      <span>Toggle theme</span>
    </SidebarMenuButton>
  );
}
