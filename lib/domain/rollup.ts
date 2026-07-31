import type { SubtaskStatus, TaskStatus } from "./enums";

export type RollupSubtask = {
  status: SubtaskStatus;
  completedAt?: Date | null;
};

/**
 * Spec §5: a task's status is derived from its subtasks — never stored.
 * Cancelled subtasks are ignored entirely; a manual "lost"/"cancelled" on the
 * task wins until it is cleared.
 *
 * Precedence: blocked > waiting > in_progress > done > not_started.
 *
 * One deliberate refinement of that list: "done" only wins when *every*
 * non-cancelled subtask is done. A task holding one done subtask and three
 * not-started ones reads as in_progress, not done — reporting it complete
 * would be actively misleading, and the spec separately requires completedAt
 * to be set only when all non-cancelled subtasks are done.
 */
export function computeTaskStatus(
  subtasks: readonly RollupSubtask[],
  manualStatus?: TaskStatus | null,
): TaskStatus {
  if (manualStatus === "lost" || manualStatus === "cancelled") {
    return manualStatus;
  }

  const active = subtasks.filter((s) => s.status !== "cancelled");
  if (active.length === 0) return "not_started";

  if (active.some((s) => s.status === "blocked")) return "blocked";
  if (active.some((s) => s.status === "waiting")) return "waiting";
  if (active.some((s) => s.status === "in_progress")) return "in_progress";

  if (active.every((s) => s.status === "done")) return "done";

  // Only done + not_started remain, and not all are done.
  if (active.some((s) => s.status === "done")) return "in_progress";

  return "not_started";
}

/** True when every non-cancelled subtask is done (and at least one exists). */
export function isTaskComplete(subtasks: readonly RollupSubtask[]): boolean {
  const active = subtasks.filter((s) => s.status !== "cancelled");
  return active.length > 0 && active.every((s) => s.status === "done");
}

/**
 * The completedAt a task should carry given its subtasks: the moment the last
 * subtask finished, or null while work remains.
 */
export function computeTaskCompletedAt(
  subtasks: readonly RollupSubtask[],
): Date | null {
  if (!isTaskComplete(subtasks)) return null;

  const times = subtasks
    .filter((s) => s.status !== "cancelled")
    .map((s) => s.completedAt)
    .filter((d): d is Date => d instanceof Date);

  if (times.length === 0) return new Date();
  return new Date(Math.max(...times.map((d) => d.getTime())));
}

/** Progress for the task list: done / non-cancelled. */
export function computeProgress(subtasks: readonly RollupSubtask[]): {
  done: number;
  total: number;
  percent: number;
} {
  const active = subtasks.filter((s) => s.status !== "cancelled");
  const done = active.filter((s) => s.status === "done").length;
  const total = active.length;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}
