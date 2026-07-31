"use client";

import Link from "next/link";
import { useState } from "react";
import { BellIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { ReminderItem } from "@/lib/domain/queries";
import { cn } from "@/lib/utils";

/**
 * The always-visible shortcut to "who do I chase today". Same data as the
 * dashboard's "Needs reminder today" widget.
 */
export function ReminderBell({ items }: { items: ReminderItem[] }) {
  const [open, setOpen] = useState(false);
  const count = items.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={
          count === 0
            ? "Reminders: nothing to chase today"
            : `Reminders: ${count} to chase today`
        }
        className={cn(
          "relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors",
          "hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
      >
        <BellIcon className="size-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white tabular-nums">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] gap-0 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-medium">Needs a reminder</p>
          {count > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {count}
            </Badge>
          )}
        </div>
        <Separator />

        {count === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing to chase today
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {items.map((item) => (
              <li key={item.subtaskId}>
                <Link
                  href={`/tasks/${item.taskId}?subtask=${item.subtaskId}`}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 transition-colors hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{item.subtaskTitle}</span>
                    {item.priority === "high" && (
                      <Badge variant="destructive" className="shrink-0">
                        High
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.taskTitle} · {item.ownerName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {item.daysWaiting !== null
                      ? `Waiting ${item.daysWaiting}d`
                      : "Waiting"}
                    {item.daysSinceLastContact !== null &&
                      ` · last contact ${item.daysSinceLastContact}d ago`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
