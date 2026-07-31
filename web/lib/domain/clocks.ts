import { differenceInCalendarDays, startOfDay } from "date-fns";

import { REMINDER_EVENT_TYPES, type HistoryEventType, type Priority, type SubtaskStatus } from "./enums";

/**
 * Spec §5: two independent clocks.
 *
 *  - daysWaiting   — how long they have owed me this. Runs from requestedDate
 *                    while the subtask is waiting. Chasing them does NOT
 *                    reset it.
 *  - reminder cooldown — how long since I last made contact. Runs from the
 *                    newest history event (falling back to requestedDate).
 *                    Logging a reminder DOES reset it.
 *
 * Both are derived at read time; neither is ever persisted.
 */

export type ClockHistoryEvent = {
  type: HistoryEventType;
  occurredAt: Date;
};

export type ClockSubtask = {
  status: SubtaskStatus;
  requestedDate?: Date | null;
  dueDate?: Date | null;
  alertAfterDays?: number | null;
  history?: readonly ClockHistoryEvent[];
};

export type SubtaskClocks = {
  /** Days since requestedDate while waiting; null when not waiting or no date. */
  daysWaiting: number | null;
  /** Newest history event, or requestedDate when there is no history yet. */
  lastContactAt: Date | null;
  /** Days since lastContactAt; null when there is nothing to measure from. */
  daysSinceLastContact: number | null;
  /** Subtask override, else the AppSettings default. */
  effectiveAlertAfterDays: number;
  /** How many times I have chased on this subtask. */
  reminderCount: number;
  /** Waiting, and the cooldown has elapsed. */
  needsReminder: boolean;
  /** dueDate is strictly before today and the subtask is still open. */
  isOverdue: boolean;
  /** dueDate is today and the subtask is still open. */
  isDueToday: boolean;
};

function newest(events: readonly ClockHistoryEvent[]): Date | null {
  if (events.length === 0) return null;
  return new Date(Math.max(...events.map((e) => e.occurredAt.getTime())));
}

export function computeClocks(
  subtask: ClockSubtask,
  defaultAlertAfterDays: number,
  today: Date = new Date(),
): SubtaskClocks {
  const history = subtask.history ?? [];
  const reference = startOfDay(today);

  const isWaiting = subtask.status === "waiting";
  const isOpen = subtask.status !== "done" && subtask.status !== "cancelled";

  const daysWaiting =
    isWaiting && subtask.requestedDate
      ? Math.max(0, differenceInCalendarDays(reference, startOfDay(subtask.requestedDate)))
      : null;

  const lastContactAt = newest(history) ?? subtask.requestedDate ?? null;

  const daysSinceLastContact = lastContactAt
    ? Math.max(0, differenceInCalendarDays(reference, startOfDay(lastContactAt)))
    : null;

  const effectiveAlertAfterDays =
    subtask.alertAfterDays ?? defaultAlertAfterDays;

  const reminderCount = history.filter((e) =>
    REMINDER_EVENT_TYPES.includes(e.type),
  ).length;

  const needsReminder =
    isWaiting &&
    daysSinceLastContact !== null &&
    daysSinceLastContact >= effectiveAlertAfterDays;

  const dueDelta = subtask.dueDate
    ? differenceInCalendarDays(startOfDay(subtask.dueDate), reference)
    : null;

  return {
    daysWaiting,
    lastContactAt,
    daysSinceLastContact,
    effectiveAlertAfterDays,
    reminderCount,
    needsReminder,
    isOverdue: isOpen && dueDelta !== null && dueDelta < 0,
    isDueToday: isOpen && dueDelta === 0,
  };
}

/** Sort key for "chase these first": most overdue on the cooldown wins. */
export function reminderUrgency(clocks: SubtaskClocks, priority: Priority): number {
  const overdueBy =
    (clocks.daysSinceLastContact ?? 0) - clocks.effectiveAlertAfterDays;
  const priorityWeight = priority === "high" ? 100 : priority === "medium" ? 10 : 0;
  return overdueBy + priorityWeight;
}
