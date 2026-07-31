import "server-only";

import { getDataClient, unwrap } from "@/lib/supabase/data";

import { toSubtaskStatus } from "./enums";
import { computeTaskCompletedAt } from "./rollup";

/**
 * A task's completed_at is the one derived value the spec asks us to persist, so
 * it must be recomputed after anything that changes its subtasks' statuses.
 * The task's status itself stays derived at read time.
 */
export async function syncTaskCompletion(taskId: string) {
  const supabase = await getDataClient();

  const rows = unwrap(
    await supabase
      .from("subtasks")
      .select("status, completed_at")
      .eq("task_id", taskId),
    "syncTaskCompletion/read",
  ) as { status: string; completed_at: string | null }[];

  const completedAt = computeTaskCompletedAt(
    rows.map((row) => ({
      status: toSubtaskStatus(row.status),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
    })),
  );

  const { error } = await supabase
    .from("tasks")
    .update({ completed_at: completedAt ? completedAt.toISOString() : null })
    .eq("id", taskId);

  if (error) throw new Error(`syncTaskCompletion/write: ${error.message}`);
}
