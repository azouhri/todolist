import { differenceInCalendarDays, startOfDay } from "date-fns";

import { PageContainer } from "@/components/layout/page-container";
import { TaskListView } from "@/components/tasks/task-list-view";
import { listTasks } from "@/lib/domain/queries";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const tasks = await listTasks();
  const today = startOfDay(new Date());

  return (
    <PageContainer>
      <TaskListView
        tasks={tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          label: task.label,
          priority: task.priority,
          status: task.status,
          dueDate: task.dueDate,
          updatedAt: task.updatedAt,
          progress: task.progress,
          needsReminderCount: task.needsReminderCount,
          overdueCount: task.subtasks.filter((s) => s.clocks.isOverdue).length,
          isOverdue:
            task.dueDate !== null &&
            task.status !== "done" &&
            task.status !== "cancelled" &&
            task.status !== "lost" &&
            differenceInCalendarDays(startOfDay(task.dueDate), today) < 0,
        }))}
      />
    </PageContainer>
  );
}
