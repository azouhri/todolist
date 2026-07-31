import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { listNeedsReminder } from "@/lib/domain/queries";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * The signed-in app shell. The proxy already redirects anonymous requests, but
 * this re-checks server-side: the proxy is a routing concern, and data must
 * never render without a verified session.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const reminders = await listNeedsReminder();

  return (
    <SidebarProvider>
      <AppSidebar reminderCount={reminders.length} userEmail={user.email ?? null} />
      {/* Fixed viewport height so the board can fill the page and scroll its
          columns internally rather than the document. */}
      <SidebarInset className="flex h-svh min-w-0 flex-col overflow-hidden">
        <AppHeader reminders={reminders} />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
