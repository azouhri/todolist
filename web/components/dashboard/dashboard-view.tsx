import Link from "next/link";

import { OverdueBadge, PriorityBadge, StatusBadge } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/date";
import type { Priority, SubtaskStatus, TaskStatus } from "@/lib/domain/enums";

/** Spec §8 — the "what needs me today" view. */

export type DashboardSubtask = {
  id: string;
  taskId: string;
  title: string;
  taskTitle: string;
  ownerName: string;
  status: SubtaskStatus;
  priority: Priority;
  dueDate: Date | null;
  daysWaiting: number | null;
  daysSinceLastContact: number | null;
  isDueToday: boolean;
};

export type DashboardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  progress: { done: number; total: number; percent: number };
  needsReminderCount: number;
  updatedAt: Date;
};

export type OwnerBucket = {
  ownerName: string;
  waiting: number;
  needsReminder: number;
  oldestDaysWaiting: number | null;
};

function Widget({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          {title}
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {count}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
  );
}

function SubtaskLine({
  subtask,
  trailing,
}: {
  subtask: DashboardSubtask;
  trailing?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={`/tasks/${subtask.taskId}?subtask=${subtask.id}`}
        className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {subtask.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {subtask.ownerName} · {subtask.taskTitle}
          </span>
        </span>
        {trailing}
      </Link>
    </li>
  );
}

export function DashboardView({
  needsReminder,
  waitingOn,
  dueSoon,
  blocked,
  tasks,
  highPriority,
  recentlyUpdated,
}: {
  needsReminder: DashboardSubtask[];
  waitingOn: OwnerBucket[];
  dueSoon: DashboardSubtask[];
  blocked: DashboardSubtask[];
  tasks: DashboardTask[];
  highPriority: DashboardSubtask[];
  recentlyUpdated: DashboardTask[];
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <Widget
          title="Needs a reminder today"
          count={needsReminder.length}
        >
          {needsReminder.length === 0 ? (
            <Empty>Nothing to chase today</Empty>
          ) : (
            <ul className="space-y-0.5">
              {needsReminder.map((subtask) => (
                <SubtaskLine
                  key={subtask.id}
                  subtask={subtask}
                  trailing={
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {subtask.daysSinceLastContact}d quiet
                    </span>
                  }
                />
              ))}
            </ul>
          )}
        </Widget>

        <Widget
          title="Waiting on"
          count={waitingOn.length}
        >
          {waitingOn.length === 0 ? (
            <Empty>You are not waiting on anyone</Empty>
          ) : (
            <ul className="space-y-0.5">
              {waitingOn.map((bucket) => (
                <li
                  key={bucket.ownerName}
                  className="flex items-center gap-2 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {bucket.ownerName}
                  </span>
                  {bucket.needsReminder > 0 && (
                    <Badge className="bg-amber-500/15 text-amber-700 tabular-nums dark:text-amber-300">
                      {bucket.needsReminder} to chase
                    </Badge>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {bucket.waiting} open
                    {bucket.oldestDaysWaiting !== null &&
                      ` · oldest ${bucket.oldestDaysWaiting}d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget
          title="Due today & overdue"
          count={dueSoon.length}
        >
          {dueSoon.length === 0 ? (
            <Empty>Nothing due</Empty>
          ) : (
            <ul className="space-y-0.5">
              {dueSoon.map((subtask) => (
                <SubtaskLine
                  key={subtask.id}
                  subtask={subtask}
                  trailing={<OverdueBadge dueToday={subtask.isDueToday} />}
                />
              ))}
            </ul>
          )}
        </Widget>

        <Widget
          title="Blocked"
          count={blocked.length}
        >
          {blocked.length === 0 ? (
            <Empty>Nothing blocked</Empty>
          ) : (
            <ul className="space-y-0.5">
              {blocked.map((subtask) => (
                <SubtaskLine key={subtask.id} subtask={subtask} />
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="By task" count={tasks.length}>
          {tasks.length === 0 ? (
            <Empty>No tasks yet</Empty>
          ) : (
            <ul className="space-y-0.5">
              {tasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {task.title}
                    </span>
                    <StatusBadge status={task.status} />
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {task.progress.done}/{task.progress.total}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget
          title="High priority"
          count={highPriority.length}
        >
          {highPriority.length === 0 ? (
            <Empty>Nothing flagged high</Empty>
          ) : (
            <ul className="space-y-0.5">
              {highPriority.map((subtask) => (
                <SubtaskLine
                  key={subtask.id}
                  subtask={subtask}
                  trailing={
                    <>
                      <PriorityBadge priority={subtask.priority} />
                      <StatusBadge status={subtask.status} />
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="Recently updated" count={recentlyUpdated.length}>
          {recentlyUpdated.length === 0 ? (
            <Empty>Nothing yet</Empty>
          ) : (
            <ul className="space-y-0.5">
              {recentlyUpdated.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {task.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(task.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>
    </div>
  );
}
