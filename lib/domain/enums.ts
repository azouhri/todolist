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
  "done",
  "cancelled",
] as const;
export const subtaskStatusSchema = z.enum(SUBTASK_STATUSES);
export type SubtaskStatus = z.infer<typeof subtaskStatusSchema>;

/** Task status adds the two manual-override values on top of the roll-up set. */
export const TASK_STATUSES = [
  "not_started",
  "in_progress",
  "waiting",
  "blocked",
  "done",
  "lost",
  "cancelled",
] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/** Only these two can be set manually; everything else is derived. */
export const MANUAL_TASK_STATUSES = ["lost", "cancelled"] as const;
export const manualTaskStatusSchema = z.enum(MANUAL_TASK_STATUSES);
export type ManualTaskStatus = z.infer<typeof manualTaskStatusSchema>;

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
  done: "Done",
  cancelled: "Cancelled",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
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
