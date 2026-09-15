import { z } from "zod";

/**
 * SQLite has no enum support, so the spec's enums live here as the single
 * source of truth: zod schemas for validating writes, arrays for building
 * <Select> options, and label maps for display.
 */

export const PRIORITIES = ["low", "medium", "high"] as const;
export const prioritySchema = z.enum(PRIORITIES);
export type Priority = z.infer<typeof prioritySchema>;

export const SUBTASK_STATUSES = [
  "not_started",
  "in_progress",
  "waiting",
  "blocked",
  "on_hold",
  "done",
  "cancelled",
] as const;
export const subtaskStatusSchema = z.enum(SUBTASK_STATUSES);
export type SubtaskStatus = z.infer<typeof subtaskStatusSchema>;

/** Task status adds the manual-override values on top of the roll-up set. */
export const TASK_STATUSES = [
  "not_started",
  "in_progress",
  "waiting",
  "blocked",
  "on_hold",
  "done",
  "lost",
  "cancelled",
] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/**
 * Only these can be set manually; everything else is derived.
 *
 * "on_hold" is here as well as in the roll-up set because a hold is a decision
 * taken about the whole task ("park this until Q3"), not something you can
 * always express by editing subtasks one at a time.
 */
export const MANUAL_TASK_STATUSES = ["on_hold", "lost", "cancelled"] as const;
export const manualTaskStatusSchema = z.enum(MANUAL_TASK_STATUSES);
export type ManualTaskStatus = z.infer<typeof manualTaskStatusSchema>;

export function isManualTaskStatus(
  status: TaskStatus,
): status is ManualTaskStatus {
  return (MANUAL_TASK_STATUSES as readonly TaskStatus[]).includes(status);
}

/**
 * Terminal outcomes: the work is over, however it ended. Views that show "what
 * still needs me" hide these by default so finished tasks stop competing with
 * live ones for attention.
 */
export const FINISHED_TASK_STATUSES: readonly TaskStatus[] = [
  "done",
  "lost",
  "cancelled",
];

export function isFinishedTaskStatus(status: TaskStatus): boolean {
  return FINISHED_TASK_STATUSES.includes(status);
}

/**
 * Statuses that take a subtask out of the "what needs me" conversation: the
 * work is over, or it has been deliberately parked. Due dates stop raising
 * flags for these and the dashboard's attention widgets skip them.
 *
 * "on_hold" belongs here but deliberately *not* in the finished set above. A
 * hold is a pause, not an outcome — the subtask keeps its dates and clocks so
 * nothing is lost if it comes back; they simply stop nagging while it is
 * parked.
 */
export const DORMANT_SUBTASK_STATUSES: readonly SubtaskStatus[] = [
  "on_hold",
  "done",
  "cancelled",
];

export function isDormantSubtaskStatus(status: SubtaskStatus): boolean {
  return DORMANT_SUBTASK_STATUSES.includes(status);
}

/**
 * Whether a list showing finished tasks should include them right now.
 *
 * The toggle drives it, with one override: asking for a terminal status by
 * name outranks the default. Filtering to "Done" and getting an empty list
 * would read as a bug, so the explicit request wins.
 */
export function showsFinishedTasks(
  showFinished: boolean,
  statusFilter: TaskStatus | "all",
): boolean {
  if (showFinished) return true;
  return statusFilter !== "all" && isFinishedTaskStatus(statusFilter);
}

export const HISTORY_EVENT_TYPES = [
  "requested",
  "reminder_sent",
  "reply_received",
  "meeting",
  "escalated",
  "status_change",
  "note",
] as const;
export const historyEventTypeSchema = z.enum(HISTORY_EVENT_TYPES);
export type HistoryEventType = z.infer<typeof historyEventTypeSchema>;

/** Events that count as "I chased them" for the reminder cooldown. */
export const REMINDER_EVENT_TYPES: readonly HistoryEventType[] = [
  "reminder_sent",
  "escalated",
];

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const SUBTASK_STATUS_LABELS: Record<SubtaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
  on_hold: "On hold",
  done: "Done",
  cancelled: "Cancelled",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
  on_hold: "On hold",
  done: "Done",
  lost: "Lost",
  cancelled: "Cancelled",
};

export const HISTORY_EVENT_LABELS: Record<HistoryEventType, string> = {
  requested: "Requested",
  reminder_sent: "Reminder sent",
  reply_received: "Reply received",
  meeting: "Meeting",
  escalated: "Escalated",
  status_change: "Status change",
  note: "Note",
};

/**
 * Rows come back from SQLite as plain strings. These coerce defensively so a
 * hand-edited database row can never crash a render.
 */
export function toSubtaskStatus(value: string): SubtaskStatus {
  const parsed = subtaskStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "not_started";
}

export function toTaskStatus(value: string): TaskStatus {
  const parsed = taskStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "not_started";
}

export function toPriority(value: string): Priority {
  const parsed = prioritySchema.safeParse(value);
  return parsed.success ? parsed.data : "medium";
}

export function toHistoryEventType(value: string): HistoryEventType {
  const parsed = historyEventTypeSchema.safeParse(value);
  return parsed.success ? parsed.data : "note";
}
