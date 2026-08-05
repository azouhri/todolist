import { BoardView } from "@/components/board/board-view";
import { listContacts, listSubtasksWithTask } from "@/lib/domain/queries";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const [subtasks, contacts] = await Promise.all([
    listSubtasksWithTask(),
    listContacts(),
  ]);

  return (
    <BoardView
      cards={subtasks.map((subtask) => ({
        id: subtask.id,
        title: subtask.title,
        status: subtask.status,
        priority: subtask.priority,
        ownerId: subtask.owner.id,
        ownerName: subtask.owner.name,
        taskId: subtask.task.id,
        taskTitle: subtask.task.title,
        label: subtask.task.label,
        daysWaiting: subtask.clocks.daysWaiting,
        needsReminder: subtask.clocks.needsReminder,
        isOverdue: subtask.clocks.isOverdue,
        isDueToday: subtask.clocks.isDueToday,
        isFocused: subtask.isFocused,
        isArchived: subtask.isArchived,
      }))}
      contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
