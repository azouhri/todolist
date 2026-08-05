import "server-only";

import { getDataClient, unwrap } from "@/lib/supabase/data";
import {
  toContact,
  toHistoryEvent,
  toSubtask,
  toTask,
  type ContactRow,
  type HistoryEvent,
  type HistoryRow,
  type SubtaskRow,
  type TaskRow,
} from "@/lib/supabase/rows";

import { computeClocks, reminderUrgency, type SubtaskClocks } from "./clocks";
import type { Priority, SubtaskStatus, TaskStatus } from "./enums";
import { computeProgress, computeTaskStatus, type RollupSubtask } from "./rollup";
import { getSettings } from "./settings";

/**
 * Read-model layer. Everything the UI renders comes from here with the derived
 * fields already attached, so no component recomputes a clock or a roll-up.
 *
 * Embedded selects (`owner:contacts(*)`) are PostgREST resource embedding — one
 * request per screen rather than N+1.
 */

const SUBTASK_SELECT = "*, owner:contacts(*), history:history_events(*)";

type SubtaskWithRelations = SubtaskRow & {
  owner: ContactRow | null;
  history: HistoryRow[] | null;
};

export type EnrichedHistoryEvent = HistoryEvent;

export type EnrichedSubtask = {
  id: string;
  taskId: string;
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
  isFocused: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: { id: string; name: string; email: string | null; isSelf: boolean };
  history: EnrichedHistoryEvent[];
  clocks: SubtaskClocks;
};

export type EnrichedTask = {
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
  subtasks: EnrichedSubtask[];
  /** Derived roll-up — never read from the database. */
  status: TaskStatus;
  progress: { done: number; total: number; percent: number };
  needsReminderCount: number;
};

/** Owner is non-null by schema; this keeps a hand-edited row from crashing a render. */
const MISSING_OWNER = {
  id: "",
  name: "(unknown)",
  email: null,
  isSelf: false,
} as const;

export function enrichSubtask(
  row: SubtaskWithRelations,
  defaultAlertAfterDays: number,
  today: Date = new Date(),
): EnrichedSubtask {
  const subtask = toSubtask(row);

  // Newest first; sorted here rather than in PostgREST so nested ordering
  // cannot silently differ between queries.
  const history = (row.history ?? [])
    .map(toHistoryEvent)
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  const owner = row.owner
    ? (({ id, name, email, isSelf }) => ({ id, name, email, isSelf }))(
        toContact(row.owner),
      )
    : MISSING_OWNER;

  return {
    ...subtask,
    owner,
    history,
    clocks: computeClocks(
      {
        status: subtask.status,
        requestedDate: subtask.requestedDate,
        dueDate: subtask.dueDate,
        alertAfterDays: subtask.alertAfterDays,
        history,
      },
      defaultAlertAfterDays,
      today,
    ),
  };
}

export function enrichTask(
  row: TaskRow & { subtasks: SubtaskWithRelations[] | null },
  defaultAlertAfterDays: number,
  today: Date = new Date(),
): EnrichedTask {
  const task = toTask(row);

  const subtasks = (row.subtasks ?? [])
    .map((s) => enrichSubtask(s, defaultAlertAfterDays, today))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const rollupInput: RollupSubtask[] = subtasks.map((s) => ({
    status: s.status,
    completedAt: s.completedAt,
  }));

  return {
    ...task,
    subtasks,
    status: computeTaskStatus(rollupInput, task.manualStatus),
    progress: computeProgress(rollupInput),
    needsReminderCount: subtasks.filter((s) => s.clocks.needsReminder).length,
  };
}

export async function listTasks(): Promise<EnrichedTask[]> {
  const [supabase, settings] = await Promise.all([getDataClient(), getSettings()]);
  const today = new Date();

  const rows = unwrap(
    await supabase
      .from("tasks")
      .select(`*, subtasks(${SUBTASK_SELECT})`)
      .order("sort_order", { ascending: true }),
    "listTasks",
  ) as (TaskRow & { subtasks: SubtaskWithRelations[] | null })[];

  return rows.map((row) => enrichTask(row, settings.defaultAlertAfterDays, today));
}

export async function getTask(id: string): Promise<EnrichedTask | null> {
  const [supabase, settings] = await Promise.all([getDataClient(), getSettings()]);

  const { data, error } = await supabase
    .from("tasks")
    .select(`*, subtasks(${SUBTASK_SELECT})`)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getTask: ${error.message}`);
  if (!data) return null;

  return enrichTask(
    data as TaskRow & { subtasks: SubtaskWithRelations[] | null },
    settings.defaultAlertAfterDays,
    new Date(),
  );
}

/** Every subtask with its parent task attached — powers the board and dashboard. */
export async function listSubtasksWithTask(): Promise<
  (EnrichedSubtask & { task: { id: string; title: string; label: string | null } })[]
> {
  const [supabase, settings] = await Promise.all([getDataClient(), getSettings()]);
  const today = new Date();

  const rows = unwrap(
    await supabase
      .from("subtasks")
      .select(`${SUBTASK_SELECT}, task:tasks(id, title, label)`)
      .order("board_order", { ascending: true }),
    "listSubtasksWithTask",
  ) as (SubtaskWithRelations & {
    task: { id: string; title: string; label: string | null } | null;
  })[];

  return rows.map((row) => ({
    ...enrichSubtask(row, settings.defaultAlertAfterDays, today),
    task: row.task ?? { id: row.task_id, title: "(unknown task)", label: null },
  }));
}

export type ReminderItem = {
  subtaskId: string;
  taskId: string;
  subtaskTitle: string;
  taskTitle: string;
  ownerName: string;
  daysWaiting: number | null;
  daysSinceLastContact: number | null;
  priority: Priority;
};

/**
 * Shared by the nav bell and the dashboard "Needs reminder today" widget so the
 * two can never disagree.
 */
export async function listNeedsReminder(): Promise<ReminderItem[]> {
  const [supabase, settings] = await Promise.all([getDataClient(), getSettings()]);
  const today = new Date();

  const rows = unwrap(
    await supabase
      .from("subtasks")
      .select(`${SUBTASK_SELECT}, task:tasks(id, title)`)
      .eq("status", "waiting"),
    "listNeedsReminder",
  ) as (SubtaskWithRelations & { task: { id: string; title: string } | null })[];

  return rows
    .map((row) => ({
      enriched: enrichSubtask(row, settings.defaultAlertAfterDays, today),
      task: row.task,
    }))
    .filter(({ enriched }) => enriched.clocks.needsReminder)
    .sort(
      (a, b) =>
        reminderUrgency(b.enriched.clocks, b.enriched.priority) -
        reminderUrgency(a.enriched.clocks, a.enriched.priority),
    )
    .map(({ enriched, task }) => ({
      subtaskId: enriched.id,
      taskId: task?.id ?? enriched.taskId,
      subtaskTitle: enriched.title,
      taskTitle: task?.title ?? "(unknown task)",
      ownerName: enriched.owner.name,
      daysWaiting: enriched.clocks.daysWaiting,
      daysSinceLastContact: enriched.clocks.daysSinceLastContact,
      priority: enriched.priority,
    }));
}

export type ContactWithCount = {
  id: string;
  name: string;
  email: string | null;
  team: string | null;
  notes: string | null;
  isSelf: boolean;
  subtaskCount: number;
};

export async function listContacts(): Promise<ContactWithCount[]> {
  const supabase = await getDataClient();

  const rows = unwrap(
    await supabase
      .from("contacts")
      .select("*, subtasks(id)")
      .order("is_self", { ascending: false })
      .order("name", { ascending: true }),
    "listContacts",
  ) as (ContactRow & { subtasks: { id: string }[] | null })[];

  return rows.map((row) => ({
    ...(({ id, name, email, team, notes, isSelf }) => ({
      id,
      name,
      email,
      team,
      notes,
      isSelf,
    }))(toContact(row)),
    subtaskCount: row.subtasks?.length ?? 0,
  }));
}
