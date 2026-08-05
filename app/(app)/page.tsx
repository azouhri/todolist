import { PageContainer } from "@/components/layout/page-container";
import {
  DashboardView,
  type DashboardSubtask,
  type OwnerBucket,
} from "@/components/dashboard/dashboard-view";
import { listSubtasksWithTask, listTasks } from "@/lib/domain/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [subtasks, tasks] = await Promise.all([
    listSubtasksWithTask(),
    listTasks(),
  ]);

  const toDashboardSubtask = (
    subtask: (typeof subtasks)[number],
  ): DashboardSubtask => ({
    id: subtask.id,
    taskId: subtask.task.id,
    title: subtask.title,
    taskTitle: subtask.task.title,
    ownerName: subtask.owner.name,
    status: subtask.status,
    priority: subtask.priority,
    dueDate: subtask.dueDate,
    daysWaiting: subtask.clocks.daysWaiting,
    daysSinceLastContact: subtask.clocks.daysSinceLastContact,
    isDueToday: subtask.clocks.isDueToday,
    needsChasing: subtask.clocks.needsReminder,
  });

  const isOpen = (s: (typeof subtasks)[number]) =>
    s.status !== "done" && s.status !== "cancelled";

  const needsReminder = subtasks
    .filter((s) => s.clocks.needsReminder)
    .sort(
      (a, b) =>
        (b.clocks.daysSinceLastContact ?? 0) - (a.clocks.daysSinceLastContact ?? 0),
    )
    .map(toDashboardSubtask);

  // Grouped by the person who owes it — the "who owes me what" answer.
  const buckets = new Map<string, OwnerBucket>();
  for (const subtask of subtasks) {
    if (subtask.status !== "waiting") continue;
    const bucket = buckets.get(subtask.owner.name) ?? {
      ownerName: subtask.owner.name,
      waiting: 0,
      needsReminder: 0,
      oldestDaysWaiting: null,
      items: [],
    };
    bucket.waiting += 1;
    bucket.items.push(toDashboardSubtask(subtask));
    if (subtask.clocks.needsReminder) bucket.needsReminder += 1;
    if (subtask.clocks.daysWaiting !== null) {
      bucket.oldestDaysWaiting = Math.max(
        bucket.oldestDaysWaiting ?? 0,
        subtask.clocks.daysWaiting,
      );
    }
    buckets.set(subtask.owner.name, bucket);
  }
  for (const bucket of buckets.values()) {
    bucket.items.sort((a, b) => (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0));
  }
  // People you are most stuck on first: those needing a chase, then volume.
  const waitingOn = [...buckets.values()].sort(
    (a, b) => b.needsReminder - a.needsReminder || b.waiting - a.waiting,
  );

  const dueSoon = subtasks
    .filter((s) => s.clocks.isOverdue || s.clocks.isDueToday)
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
    .map(toDashboardSubtask);

  const blocked = subtasks
    .filter((s) => s.status === "blocked")
    .map(toDashboardSubtask);

  const highPriority = subtasks
    .filter((s) => s.priority === "high" && isOpen(s))
    .map(toDashboardSubtask);

  const toDashboardTask = (task: (typeof tasks)[number]) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    progress: task.progress,
    needsReminderCount: task.needsReminderCount,
    updatedAt: task.updatedAt,
  });

  const recentlyUpdated = [...tasks]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 6)
    .map(toDashboardTask);

  return (
    <PageContainer>
      <DashboardView
        needsReminder={needsReminder}
        waitingOn={waitingOn}
        dueSoon={dueSoon}
        blocked={blocked}
        tasks={tasks.map(toDashboardTask)}
        highPriority={highPriority}
        recentlyUpdated={recentlyUpdated}
      />
    </PageContainer>
  );
}
