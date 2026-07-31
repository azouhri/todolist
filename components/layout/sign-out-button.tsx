"use client";

import { LogOutIcon } from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export function SignOutButton({ email }: { email: string | null }) {
  return (
    <form action={signOut}>
      <SidebarMenuButton
        type="submit"
        tooltip={email ? `Sign out (${email})` : "Sign out"}
      >
        <LogOutIcon />
        <span className="truncate">{email ?? "Sign out"}</span>
      </SidebarMenuButton>
    </form>
  );
}
