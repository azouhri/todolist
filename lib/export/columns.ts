import { formatDate } from "@/lib/date";
import {
  HISTORY_EVENT_LABELS,
  PRIORITY_LABELS,
  SUBTASK_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/domain/enums";
import type { EnrichedTask } from "@/lib/domain/queries";

/**
 * Spec §10 — the shape of the export: one row per subtask, with the task's own
 * columns repeated.
 *
 * This module is deliberately free of `exceljs` and `server-only` so the export
 * dialog can import the scope and column vocabulary without dragging the
 * spreadsheet writer into the client bundle.
 */

export const EXPORT_SCOPES = ["all", "open", "waiting", "needs_reminder"] as const;
export type ExportScope = (typeof EXPORT_SCOPES)[number];

export const EXPORT_SCOPE_LABELS: Record<ExportScope, string> = {
  all: "Everything",
  open: "Open subtasks only",
  waiting: "Waiting only",
  needs_reminder: "Needs a reminder only",
};

export const OPTIONAL_COLUMNS = [
  "description",
  "dates",
  "clocks",
  "history",
] as const;
export type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];

export const OPTIONAL_COLUMN_LABELS: Record<OptionalColumn, string> = {
  description: "Descriptions",
  dates: "Requested, due and completed dates",
  clocks: "Days waiting, last contact, reminders",
  history: "Latest history note",
};

export type ColumnDef = { key: string; header: string; width: number };

/** Always present, in this order. */
const BASE_COLUMNS: ColumnDef[] = [
  { key: "taskTitle", header: "Task", width: 32 },
  { key: "taskStatus", header: "Task status", width: 14 },
  { key: "label", header: "Label", width: 16 },
  { key: "subtaskTitle", header: "Subtask", width: 36 },
  { key: "owner", header: "Owner", width: 20 },
  { key: "status", header: "Status", width: 14 },
  { key: "priority", header: "Priority", width: 10 },
];

const OPTIONAL_COLUMN_DEFS: Record<OptionalColumn, ColumnDef[]> = {
  description: [
    { key: "taskDescription", header: "Task description", width: 40 },
    { key: "subtaskDescription", header: "Subtask description", width: 40 },
  ],
  dates: [
    { key: "requestedDate", header: "Requested", width: 14 },
    { key: "dueDate", header: "Due", width: 14 },
    { key: "completedAt", header: "Completed", width: 14 },
  ],
  clocks: [
    { key: "daysWaiting", header: "Days waiting", width: 14 },
    { key: "daysSinceLastContact", header: "Days since contact", width: 18 },
    { key: "alertAfterDays", header: "Chase after (days)", width: 18 },
    { key: "needsReminder", header: "Needs reminder", width: 16 },
    { key: "reminderCount", header: "Reminders sent", width: 16 },
  ],
  history: [
    { key: "lastEvent", header: "Latest event", width: 20 },
    { key: "lastEventNote", header: "Latest note", width: 44 },
  ],
};

export function buildColumns(optional: readonly OptionalColumn[]): ColumnDef[] {
  return [
    ...BASE_COLUMNS,
    // Canonical order, regardless of the order the options were ticked.
    ...OPTIONAL_COLUMNS.filter((c) => optional.includes(c)).flatMap(
      (c) => OPTIONAL_COLUMN_DEFS[c],
    ),
  ];
}

export type ExportRow = Record<string, string | number | null>;

export function buildRows(
  tasks: readonly EnrichedTask[],
  scope: ExportScope,
  optional: readonly OptionalColumn[],
): ExportRow[] {
  const include = (c: OptionalColumn) => optional.includes(c);
  const rows: ExportRow[] = [];

  for (const task of tasks) {
    for (const subtask of task.subtasks) {
      const isClosed = subtask.status === "done" || subtask.status === "cancelled";
      if (scope === "open" && isClosed) continue;
      if (scope === "waiting" && subtask.status !== "waiting") continue;
      if (scope === "needs_reminder" && !subtask.clocks.needsReminder) continue;

      const latest = subtask.history[0];
      const row: ExportRow = {
        taskTitle: task.title,
        taskStatus: TASK_STATUS_LABELS[task.status],
        label: task.label ?? "",
        subtaskTitle: subtask.title,
        owner: subtask.owner.name,
        status: SUBTASK_STATUS_LABELS[subtask.status],
        priority: PRIORITY_LABELS[subtask.priority],
      };

      if (include("description")) {
        row.taskDescription = task.description ?? "";
        row.subtaskDescription = subtask.description ?? "";
      }
      if (include("dates")) {
        row.requestedDate = subtask.requestedDate
          ? formatDate(subtask.requestedDate)
          : "";
        row.dueDate = subtask.dueDate ? formatDate(subtask.dueDate) : "";
        row.completedAt = subtask.completedAt
          ? formatDate(subtask.completedAt)
          : "";
      }
      if (include("clocks")) {
        row.daysWaiting = subtask.clocks.daysWaiting ?? "";
        row.daysSinceLastContact = subtask.clocks.daysSinceLastContact ?? "";
        row.alertAfterDays = subtask.clocks.effectiveAlertAfterDays;
        row.needsReminder = subtask.clocks.needsReminder ? "Yes" : "No";
        row.reminderCount = subtask.clocks.reminderCount;
      }
      if (include("history")) {
        row.lastEvent = latest ? HISTORY_EVENT_LABELS[latest.type] : "";
        row.lastEventNote = latest?.note ?? "";
      }

      rows.push(row);
    }
  }

  return rows;
}
