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
