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

/**
 * A widget only ever renders with something in it — see the filter in
 * `DashboardView` — so the count badge is unconditional and there is no empty
 * state to handle here.
 *
 * The body scrolls inside the card rather than growing it. One busy widget
 * used to push every other card off the screen, which defeats the point of a
 * dashboard: the header stays put and the overflow is the widget's problem,
 * not the page's.
 */
function Widget({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          {title}
          <Badge variant="secondary" className="tabular-nums">
            {count}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-80 overflow-y-auto">{children}</CardContent>
    </Card>
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

/**
 * "Waiting on" is grouped by person rather than by task: it exists to answer
 * "who owes me what", so the owner stays the headline.
 */
function OwnerBuckets({ buckets }: { buckets: readonly OwnerBucket[] }) {
  return (
    <ul className="space-y-0.5">
      {buckets.map((bucket) => (
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
  );
}

/** Already one row per task, so these two widgets need no grouping. */
function TaskLines({
  tasks,
  trailing,
}: {
  tasks: readonly DashboardTask[];
  trailing: (task: DashboardTask) => React.ReactNode;
}) {
  return (
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
            {trailing(task)}
          </Link>
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
  const widgets = [
    {
      key: "needs-reminder",
      title: "Needs a reminder today",
      count: needsReminder.length,
      body: (
        <TaskGroups
          subtasks={needsReminder}
          trailing={(subtask) => (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {subtask.daysSinceLastContact}d quiet
            </span>
          )}
        />
      ),
    },
    {
      key: "waiting-on",
      title: "Waiting on",
      count: waitingOn.length,
      body: <OwnerBuckets buckets={waitingOn} />,
    },
    {
      key: "due-soon",
      title: "Due today & overdue",
      count: dueSoon.length,
      body: (
        <TaskGroups
          subtasks={dueSoon}
          trailing={(subtask) => <OverdueBadge dueToday={subtask.isDueToday} />}
        />
      ),
    },
    {
      key: "blocked",
      title: "Blocked",
      count: blocked.length,
      body: <TaskGroups subtasks={blocked} />,
    },
    {
      key: "by-task",
      title: "By task",
      count: tasks.length,
      body: (
        <TaskLines
          tasks={tasks}
          trailing={(task) => (
            <>
              <StatusBadge status={task.status} />
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {task.progress.done}/{task.progress.total}
              </span>
            </>
          )}
        />
      ),
    },
    {
      key: "high-priority",
      title: "High priority",
      count: highPriority.length,
      body: (
        <TaskGroups
          subtasks={highPriority}
          trailing={(subtask) => (
            <>
              <PriorityBadge priority={subtask.priority} />
              <StatusBadge status={subtask.status} />
            </>
          )}
        />
      ),
    },
    {
      key: "recently-updated",
      title: "Recently updated",
      count: recentlyUpdated.length,
      body: (
        <TaskLines
          tasks={recentlyUpdated}
          trailing={(task) => (
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDate(task.updatedAt)}
            </span>
          )}
        />
      ),
    },
  ];

  // An empty widget is worse than no widget: "Nothing blocked" is a whole card
  // of reassurance nobody asked for, and it pushes the widgets that do have
  // something to say off the screen. Silence is the good news.
  const visible = widgets.filter((widget) => widget.count > 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing needs you right now.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href="/tasks" className="underline">
              Create a task
            </Link>{" "}
            when something comes up.
          </p>
        </div>
      ) : (
        // items-start stops a short card being stretched to match the tallest
        // one in its row — with cards this varied, ragged beats padded out.
        <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visible.map((widget) => (
            <Widget key={widget.key} title={widget.title} count={widget.count}>
              {widget.body}
            </Widget>
          ))}
        </div>
      )}
    </div>
  );
}
