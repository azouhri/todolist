"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ContactIcon,
  KanbanSquareIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  SettingsIcon,
  TargetIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/tasks", label: "Tasks", icon: ListChecksIcon },
  { href: "/board", label: "Board", icon: KanbanSquareIcon },
] as const;

const SETUP = [
  { href: "/contacts", label: "Contacts", icon: ContactIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Collapsible to an icon rail (the trigger lives in the header, and the rail
 * edge is draggable/clickable too).
 */
export function AppSidebar({
  reminderCount,
  userEmail,
}: {
  reminderCount: number;
  userEmail: string | null;
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Follow-up Manager" render={<Link href="/" />}>
              <span className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <TargetIcon className="size-4" />
              </span>
              <span className="truncate font-semibold">Follow-ups</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Track</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(pathname, item.href)}
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.href === "/" && reminderCount > 0 && (
                    <SidebarMenuBadge>{reminderCount}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Setup</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SETUP.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(pathname, item.href)}
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SignOutButton email={userEmail} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
