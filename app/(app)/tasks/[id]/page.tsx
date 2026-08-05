import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { TaskDetailView } from "@/components/tasks/task-detail-view";
import { getTask, listContacts } from "@/lib/domain/queries";
import { getDefaultOwnerId } from "@/lib/domain/settings";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  // Next 16: both are promises.
  params: Promise<{ id: string }>;
  searchParams: Promise<{ subtask?: string }>;
}) {
  const [{ id }, { subtask: focusSubtaskId }, contacts, defaultOwnerId] =
    await Promise.all([
      params,
      searchParams,
      listContacts(),
      getDefaultOwnerId(),
    ]);

  const task = await getTask(id);
  if (!task) notFound();

  return (
    <PageContainer>
      <TaskDetailView
        task={{
          id: task.id,
          title: task.title,
          description: task.description,
          label: task.label,
          priority: task.priority,
          status: task.status,
          manualStatus: task.manualStatus,
          dueDate: task.dueDate,
          completedAt: task.completedAt,
          progress: task.progress,
        }}
        subtasks={task.subtasks.map((subtask) => ({
          id: subtask.id,
          title: subtask.title,
          status: subtask.status,
          priority: subtask.priority,
          ownerId: subtask.owner.id,
          ownerName: subtask.owner.name,
          requestedDate: subtask.requestedDate,
          dueDate: subtask.dueDate,
          alertAfterDays: subtask.alertAfterDays,
        isFocused: subtask.isFocused,
        isArchived: subtask.isArchived,
          clocks: {
            daysWaiting: subtask.clocks.daysWaiting,
            daysSinceLastContact: subtask.clocks.daysSinceLastContact,
            effectiveAlertAfterDays: subtask.clocks.effectiveAlertAfterDays,
            needsReminder: subtask.clocks.needsReminder,
            isOverdue: subtask.clocks.isOverdue,
            isDueToday: subtask.clocks.isDueToday,
          },
          reminderCount: subtask.clocks.reminderCount,
          history: subtask.history,
        }))}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
        defaultOwnerId={defaultOwnerId}
        focusSubtaskId={focusSubtaskId}
      />
    </PageContainer>
  );
}
