import { AlarmClockIcon, TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  PRIORITY_LABELS,
  SUBTASK_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type Priority,
  type SubtaskStatus,
  type TaskStatus,
} from "@/lib/domain/enums";
import { cn } from "@/lib/utils";

/** One colour vocabulary for statuses, shared by the list, board and dashboard. */
const STATUS_CLASSES: Record<TaskStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  waiting: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  blocked: "bg-red-500/15 text-red-700 dark:text-red-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  lost: "bg-zinc-500/20 text-zinc-700 line-through dark:text-zinc-300",
  cancelled: "bg-zinc-500/20 text-zinc-700 line-through dark:text-zinc-300",
};

/**
 * Left-edge accent for rows and cards, using the same colour vocabulary as the
 * badges so a status reads the same wherever it appears. Tints are kept very
 * low so a long list stays calm rather than turning into a rainbow.
 */
export const STATUS_ACCENT: Record<TaskStatus, string> = {
  not_started: "border-l-border",
  in_progress: "border-l-blue-500 bg-blue-500/[0.04]",
  waiting: "border-l-amber-500 bg-amber-500/[0.05]",
  blocked: "border-l-red-500 bg-red-500/[0.05]",
  done: "border-l-emerald-500/70",
  lost: "border-l-zinc-400",
  cancelled: "border-l-zinc-400",
};

export function StatusBadge({
  status,
  className,
}: {
  status: TaskStatus | SubtaskStatus;
  className?: string;
}) {
  return (
    <Badge className={cn(STATUS_CLASSES[status], className)}>
      {TASK_STATUS_LABELS[status as TaskStatus] ??
        SUBTASK_STATUS_LABELS[status as SubtaskStatus]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "medium") return null;
  return (
    <Badge
      variant={priority === "high" ? "destructive" : "outline"}
      className="shrink-0"
    >
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

/** The "chase this" flag. */
export function ReminderBadge({ days }: { days: number | null }) {
  return (
    <Badge className="shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-300">
      <AlarmClockIcon />
      {days === null ? "Chase" : `Chase · ${days}d`}
    </Badge>
  );
}

export function OverdueBadge({ dueToday }: { dueToday?: boolean }) {
  return (
    <Badge
      variant={dueToday ? "outline" : "destructive"}
      className="shrink-0"
    >
      {!dueToday && <TriangleAlertIcon />}
      {dueToday ? "Due today" : "Overdue"}
    </Badge>
  );
}
