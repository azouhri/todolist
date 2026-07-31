import type { HistoryEventType, SubtaskStatus } from "./enums";
import { SUBTASK_STATUS_LABELS } from "./enums";

/**
 * The single place that decides what a subtask status change does to the two
 * clocks. Inline edits on the task detail and kanban drops both go through
 * this, so the board can never disagree with the list.
 */

export type TransitionPatch = {
  status: SubtaskStatus;
  requestedDate?: Date | null;
  completedAt?: Date | null;
};

export type TransitionResult = {
  /** Fields to write on the subtask. */
  patch: TransitionPatch;
  /** History entry to append, so the timeline explains the clock changes. */
  event: { type: HistoryEventType; note: string } | null;
  /** Surfaced as a toast when the change had a side effect worth announcing. */
  notice: string | null;
};

export function applyStatusTransition(
  current: SubtaskStatus,
  next: SubtaskStatus,
  existingRequestedDate: Date | null,
  now: Date = new Date(),
): TransitionResult {
  const patch: TransitionPatch = { status: next };
  let notice: string | null = null;
  let event: { type: HistoryEventType; note: string } | null = {
    type: "status_change",
    note: `${SUBTASK_STATUS_LABELS[current]} → ${SUBTASK_STATUS_LABELS[next]}`,
  };

  switch (next) {
    case "waiting":
      patch.completedAt = null;
      // Entering "waiting" starts the daysWaiting clock, unless it was already
      // started by an earlier request.
      if (!existingRequestedDate) {
        patch.requestedDate = now;
        event = {
          type: "requested",
          note: `${SUBTASK_STATUS_LABELS[current]} → Waiting`,
        };
        notice = "Waiting clock started.";
      }
      break;

    case "done":
      patch.completedAt = now;
      break;

    case "not_started":
      // Back to square one: both clocks are meaningless, so clear them.
      patch.requestedDate = null;
      patch.completedAt = null;
      if (existingRequestedDate) notice = "Waiting and reminder clocks cleared.";
      break;

    case "in_progress":
    case "blocked":
    case "cancelled":
      patch.completedAt = null;
      break;
  }

  return { patch, event, notice };
}
