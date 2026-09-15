"use client";

import Link from "next/link";
import { ArrowUpRightIcon, ChevronRightIcon } from "lucide-react";

import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * One collapsed summary row on the dashboard, holding the detail behind a
 * disclosure.
 *
 * The widgets used to list every matching subtask flat, which made the page
 * grow with the backlog rather than with what actually needs attention. Each
 * widget now answers "which tasks (or people) are involved, and how many
 * items each" at a glance, and only expands the individual subtasks when
 * asked.
 *
 * Closed panels are unmounted rather than hidden, so a long backlog costs
 * nothing until it is opened. The trade-off is that the browser's find-in-page
 * cannot reach a collapsed subtask — the task list has search for that.
 *
 * This is the only client component on the dashboard: `children` arrives
 * already rendered on the server, so opening a group ships no extra data.
 */
export function CollapsibleGroup({
  title,
  href,
  trailing,
  children,
}: {
  title: string;
  /** Renders a shortcut straight to the task, skipping the expand step. */
  href?: string;
  /** Status badge, counts — whatever summarises the group while collapsed. */
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Collapsible>
      <div className="-mx-2 flex items-center gap-1 rounded-md pr-1 transition-colors hover:bg-accent">
        <CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md py-1.5 pl-2">
          <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-open/collapsible:rotate-90" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {title}
          </span>
          {trailing}
        </CollapsibleTrigger>

        {href && (
          <Link
            href={href}
            aria-label={`Open ${title}`}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowUpRightIcon className="size-3.5" />
          </Link>
        )}
      </div>

      {/* pl-5 lines the detail up under the group title, past the chevron. */}
      <CollapsiblePanel>
        <div className="space-y-0.5 py-0.5 pl-5">{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
