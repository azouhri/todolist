import {
  toHistoryEventType,
  toPriority,
  toSubtaskStatus,
  toTaskStatus,
  type HistoryEventType,
  type Priority,
  type SubtaskStatus,
  type TaskStatus,
} from "@/lib/domain/enums";

/**
 * The database is snake_case (Postgres/PostgREST convention); the app's domain
 * types are camelCase. Both directions of that translation live here and
 * nowhere else, so no component or action ever sees a snake_case key.
 */

export type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  team: string | null;
  notes: string | null;
  is_self: boolean;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  label: string | null;
  priority: string;
  manual_status: string | null;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SubtaskRow = {
  id: string;
  task_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  requested_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  alert_after_days: number | null;
  sort_order: number;
  board_order: number;
  created_at: string;
  updated_at: string;
};

export type HistoryRow = {
  id: string;
  subtask_id: string;
  type: string;
  note: string | null;
  occurred_at: string;
  created_at: string;
};

export type AppSettingsRow = {
  id: string;
  default_alert_after_days: number;
  default_owner_id: string | null;
  updated_at: string;
};

/** PostgREST returns timestamps as ISO strings. */
export function date(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

export function required(value: string): Date {
  return new Date(value);
}

export type Contact = {
  id: string;
  name: string;
  email: string | null;
  team: string | null;
  notes: string | null;
  isSelf: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    team: row.team,
    notes: row.notes,
    isSelf: row.is_self,
    createdAt: required(row.created_at),
    updatedAt: required(row.updated_at),
  };
}

export type HistoryEvent = {
  id: string;
  type: HistoryEventType;
  note: string | null;
  occurredAt: Date;
};

export function toHistoryEvent(row: HistoryRow): HistoryEvent {
  return {
    id: row.id,
    type: toHistoryEventType(row.type),
    note: row.note,
    occurredAt: required(row.occurred_at),
  };
}

export type Subtask = {
  id: string;
  taskId: string;
  ownerId: string;
  title: string;
  description: string | null;
  status: SubtaskStatus;
  priority: Priority;
  requestedDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  alertAfterDays: number | null;
  sortOrder: number;
  boardOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export function toSubtask(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    taskId: row.task_id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    status: toSubtaskStatus(row.status),
    priority: toPriority(row.priority),
    requestedDate: date(row.requested_date),
    dueDate: date(row.due_date),
    completedAt: date(row.completed_at),
    alertAfterDays: row.alert_after_days,
    sortOrder: row.sort_order,
    boardOrder: row.board_order,
    createdAt: required(row.created_at),
    updatedAt: required(row.updated_at),
  };
}

export type Task = {
  id: string;
  title: string;
  description: string | null;
  label: string | null;
  priority: Priority;
  manualStatus: TaskStatus | null;
  dueDate: Date | null;
  completedAt: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    label: row.label,
    priority: toPriority(row.priority),
    manualStatus: row.manual_status ? toTaskStatus(row.manual_status) : null,
    dueDate: date(row.due_date),
    completedAt: date(row.completed_at),
    sortOrder: row.sort_order,
    createdAt: required(row.created_at),
    updatedAt: required(row.updated_at),
  };
}

export type AppSettings = {
  id: string;
  defaultAlertAfterDays: number;
  defaultOwnerId: string | null;
};

export function toSettings(row: AppSettingsRow): AppSettings {
  return {
    id: row.id,
    defaultAlertAfterDays: row.default_alert_after_days,
    defaultOwnerId: row.default_owner_id,
  };
}

/** Domain field name -> column name, for building partial updates. */
export const SUBTASK_COLUMNS: Record<string, string> = {
  title: "title",
  description: "description",
  ownerId: "owner_id",
  status: "status",
  priority: "priority",
  requestedDate: "requested_date",
  dueDate: "due_date",
  completedAt: "completed_at",
  alertAfterDays: "alert_after_days",
  sortOrder: "sort_order",
  boardOrder: "board_order",
};

export const TASK_COLUMNS: Record<string, string> = {
  title: "title",
  description: "description",
  label: "label",
  priority: "priority",
  manualStatus: "manual_status",
  dueDate: "due_date",
  completedAt: "completed_at",
  sortOrder: "sort_order",
};

/**
 * Translates a camelCase patch into a snake_case column patch, dropping keys
 * the caller did not provide so partial updates stay partial.
 */
export function toColumns(
  patch: Record<string, unknown>,
  map: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const column = map[key];
    if (!column) continue;
    out[column] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}
