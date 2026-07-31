import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { ReminderItem } from "@/lib/domain/queries";

import { ReminderBell } from "./reminder-bell";

/**
 * Slim bar above the page: the sidebar collapse control plus the always-visible
 * "who do I chase today" bell.
 */
export function AppHeader({ reminders }: { reminders: ReminderItem[] }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="ml-auto">
        <ReminderBell items={reminders} />
      </div>
    </header>
  );
}
