import Link from "next/link";

import { CollapsibleGroup } from "@/components/dashboard/collapsible-group";
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
  /** The parent task's rolled-up status, shown on the collapsed group row. */
  taskStatus: TaskStatus;
  ownerName: string;
  status: SubtaskStatus;
  priority: Priority;
  dueDate: Date | null;
  daysWaiting: number | null;
  daysSinceLastContact: number | null;
  isDueToday: boolean;
  /** Waiting, and past its reminder cooldown. */
  needsChasing: boolean;
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
  /** What you are actually waiting for from this person. */
  items: DashboardSubtask[];
};

type TaskGroup = {
  taskId: string;
  taskTitle: string;
  taskStatus: TaskStatus;
  items: DashboardSubtask[];
};

/**
 * Collapse a flat subtask list into one entry per parent task, keeping the
 * order the caller sorted them into — the most urgent task stays on top
 * because its most urgent subtask came first.
 */
function groupByTask(subtasks: readonly DashboardSubtask[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();

  for (const subtask of subtasks) {
    const group = groups.get(subtask.taskId) ?? {
      taskId: subtask.taskId,
      taskTitle: subtask.taskTitle,
      taskStatus: subtask.taskStatus,
      items: [],
    };
    group.items.push(subtask);
    groups.set(subtask.taskId, group);
  }

  return [...groups.values()];
}

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
  subtitle,
  trailing,
}: {
  subtask: DashboardSubtask;
  /** Whichever of owner/task the surrounding group does not already state. */
  subtitle: string;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={`/tasks/${subtask.taskId}?subtask=${subtask.id}`}
      className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-accent"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{subtask.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {subtitle}
        </span>
      </span>
      {trailing}
    </Link>
  );
}

/**
 * The shared body of every subtask widget: one collapsed row per task, the
 * subtasks themselves a click away.
 */
function TaskGroups({
  subtasks,
  trailing,
}: {
  subtasks: readonly DashboardSubtask[];
  /** Per-subtask detail, rendered on the server and passed down as children. */
  trailing?: (subtask: DashboardSubtask) => React.ReactNode;
}) {
  return (
    <ul className="space-y-0.5">
      {groupByTask(subtasks).map((group) => (
        <li key={group.taskId}>
          <CollapsibleGroup
            title={group.taskTitle}
            href={`/tasks/${group.taskId}`}
            trailing={
              <>
                <StatusBadge status={group.taskStatus} />
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {group.items.length}
                </span>
              </>
            }
          >
            {group.items.map((subtask) => (
              <SubtaskLine
                key={subtask.id}
                subtask={subtask}
                subtitle={subtask.ownerName}
                trailing={trailing?.(subtask)}
              />
            ))}
          </CollapsibleGroup>
        </li>
      ))}
    </ul>
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

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Widget title="Needs a reminder today" count={needsReminder.length}>
          {needsReminder.length === 0 ? (
            <Empty>Nothing to chase today</Empty>
          ) : (
            <TaskGroups
              subtasks={needsReminder}
              trailing={(subtask) => (
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {subtask.daysSinceLastContact}d quiet
                </span>
              )}
            />
          )}
        </Widget>

        {/* Grouped by person rather than task: this widget exists to answer
            "who owes me what", so the owner stays the headline. */}
        <Widget title="Waiting on" count={waitingOn.length}>
          {waitingOn.length === 0 ? (
            <Empty>You are not waiting on anyone</Empty>
          ) : (
            <ul className="space-y-0.5">
              {waitingOn.map((bucket) => (
                <li key={bucket.ownerName}>
                  <CollapsibleGroup
                    title={bucket.ownerName}
                    trailing={
                      <>
                        {bucket.needsReminder > 0 && (
                          <Badge className="shrink-0 bg-amber-500/15 text-amber-700 tabular-nums dark:text-amber-300">
                            {bucket.needsReminder} to chase
                          </Badge>
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {bucket.waiting} open
                        </span>
                      </>
                    }
                  >
                    {bucket.items.map((item) => (
                      <SubtaskLine
                        key={item.id}
                        subtask={item}
                        subtitle={item.taskTitle}
                        trailing={
                          <>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {item.daysWaiting !== null
                                ? `waiting ${item.daysWaiting}d`
                                : "waiting"}
                            </span>
                            {item.needsChasing && (
                              <Badge className="shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                Chase
                              </Badge>
                            )}
                          </>
                        }
                      />
                    ))}
                  </CollapsibleGroup>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="Due today & overdue" count={dueSoon.length}>
          {dueSoon.length === 0 ? (
            <Empty>Nothing due</Empty>
          ) : (
            <TaskGroups
              subtasks={dueSoon}
              trailing={(subtask) => (
                <OverdueBadge dueToday={subtask.isDueToday} />
              )}
            />
          )}
        </Widget>

        <Widget title="Blocked" count={blocked.length}>
          {blocked.length === 0 ? (
            <Empty>Nothing blocked</Empty>
          ) : (
            <TaskGroups subtasks={blocked} />
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

        <Widget title="High priority" count={highPriority.length}>
          {highPriority.length === 0 ? (
            <Empty>Nothing flagged high</Empty>
          ) : (
            <TaskGroups
              subtasks={highPriority}
              trailing={(subtask) => (
                <>
                  <PriorityBadge priority={subtask.priority} />
                  <StatusBadge status={subtask.status} />
                </>
              )}
            />
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
