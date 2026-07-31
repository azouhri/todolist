import type { SubtaskStatus } from "./enums";

/**
 * Spec §6 clone rules, kept pure so they can be tested without a database.
 * History is never part of the output — a clone has not happened yet.
 */

export type CloneOptions = {
  includeSubtasks: boolean;
  keepOwners: boolean;
  keepDueDates: boolean;
  resetStatuses: boolean;
};

export type CloneableSubtask = {
  title: string;
  description: string | null;
  ownerId: string;
  status: string;
  priority: string;
  requestedDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  alertAfterDays: number | null;
  sortOrder: number;
  boardOrder: number;
};

export type ClonedSubtask = Omit<CloneableSubtask, "status"> & {
  status: SubtaskStatus | string;
};

export function cloneSubtask(
  subtask: CloneableSubtask,
  options: CloneOptions,
  fallbackOwnerId: string,
): ClonedSubtask {
  return {
    title: subtask.title,
    description: subtask.description,
    ownerId: options.keepOwners ? subtask.ownerId : fallbackOwnerId,
    status: options.resetStatuses ? "not_started" : subtask.status,
    priority: subtask.priority,
    // Resetting a status means the waiting clock has not started either.
    requestedDate: options.resetStatuses ? null : subtask.requestedDate,
    dueDate: options.keepDueDates ? subtask.dueDate : null,
    completedAt: options.resetStatuses ? null : subtask.completedAt,
    alertAfterDays: subtask.alertAfterDays,
    // Relative order is preserved; the clone is a fresh list of its own.
    sortOrder: subtask.sortOrder,
    boardOrder: subtask.boardOrder,
  };
}

export function cloneSubtasks(
  subtasks: readonly CloneableSubtask[],
  options: CloneOptions,
  fallbackOwnerId: string,
): ClonedSubtask[] {
  if (!options.includeSubtasks) return [];
  return subtasks.map((s) => cloneSubtask(s, options, fallbackOwnerId));
}

/**
 * Deleting a contact that still owns subtasks would orphan the "who owes me
 * this" answer. Returns the reason to refuse, or null when the delete is safe.
 */
export function contactDeleteBlockReason(
  name: string,
  subtaskCount: number,
): string | null {
  if (subtaskCount === 0) return null;
  return `${name} is in use by ${subtaskCount} subtask${
    subtaskCount === 1 ? "" : "s"
  }. Reassign them first.`;
}
