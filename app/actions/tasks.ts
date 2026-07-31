"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { cloneSubtasks } from "@/lib/domain/clone";
import { manualTaskStatusSchema, prioritySchema } from "@/lib/domain/enums";
import { ORDER_STEP } from "@/lib/domain/sort";
import { syncTaskCompletion } from "@/lib/domain/sync";
import { guarded } from "@/lib/server-action";
import { getDataClient, unwrap } from "@/lib/supabase/data";
import { TASK_COLUMNS, toColumns, type SubtaskRow } from "@/lib/supabase/rows";

function revalidateAll() {
  revalidatePath("/", "layout");
}

const optionalDate = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === "") return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });

const taskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(300),
  description: z.string().trim().max(4000).optional(),
  label: z.string().trim().max(120).optional(),
  priority: prioritySchema.default("medium"),
  dueDate: optionalDate,
});

export type TaskInput = z.input<typeof taskSchema>;

async function nextTaskSortOrder(): Promise<number> {
  const supabase = await getDataClient();
  const { data } = await supabase
    .from("tasks")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  return ((data as { sort_order: number } | null)?.sort_order ?? 0) + ORDER_STEP;
}

export async function createTask(
  input: TaskInput,
): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const parsed = taskSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid task.");
    }

    const supabase = await getDataClient();
    const task = unwrap(
      await supabase
        .from("tasks")
        .insert({
          title: parsed.data.title,
          description: parsed.data.description || null,
          label: parsed.data.label || null,
          priority: parsed.data.priority,
          due_date: parsed.data.dueDate?.toISOString() ?? null,
          sort_order: await nextTaskSortOrder(),
        })
        .select("id")
        .single(),
      "createTask",
    ) as { id: string };

    revalidateAll();
    return ok({ id: task.id }, "Task created.");
  });
}

const updateTaskSchema = taskSchema.partial();
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export async function updateTask(
  id: string,
  input: UpdateTaskInput,
): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = updateTaskSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid task.");
    }

    const provided: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
      // Empty text fields mean "cleared", not "empty string".
      provided[key] = value === "" ? null : value;
    }
    if (Object.keys(provided).length === 0) return ok(undefined);

    const supabase = await getDataClient();
    const { error } = await supabase
      .from("tasks")
      .update(toColumns(provided, TASK_COLUMNS))
      .eq("id", id);
    if (error) throw new Error(`updateTask: ${error.message}`);

    revalidateAll();
    return ok(undefined, "Task saved.");
  });
}

export async function deleteTask(id: string): Promise<ActionResult> {
  return guarded(async () => {
    const supabase = await getDataClient();

    const { data, error } = await supabase
      .from("tasks")
      .select("title")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`deleteTask/read: ${error.message}`);
    if (!data) return fail("That task no longer exists.");

    // Subtasks and their history cascade.
    const { error: deleteError } = await supabase.from("tasks").delete().eq("id", id);
    if (deleteError) throw new Error(`deleteTask: ${deleteError.message}`);

    revalidateAll();
    return ok(undefined, `Deleted "${(data as { title: string }).title}".`);
  });
}

/**
 * "lost" and "cancelled" are the only statuses a user sets by hand; everything
 * else is rolled up from subtasks. Passing null hands control back to the roll-up.
 */
export async function setTaskManualStatus(
  id: string,
  status: string | null,
): Promise<ActionResult> {
  return guarded(async () => {
    if (status !== null) {
      const parsed = manualTaskStatusSchema.safeParse(status);
      if (!parsed.success) {
        return fail("Only Lost and Cancelled can be set manually.");
      }
    }

    const supabase = await getDataClient();
    const { error } = await supabase
      .from("tasks")
      .update({ manual_status: status })
      .eq("id", id);
    if (error) throw new Error(`setTaskManualStatus: ${error.message}`);

    revalidateAll();
    return ok(
      undefined,
      status === null ? "Status back to automatic." : `Task marked ${status}.`,
    );
  });
}

const cloneSchema = z.object({
  title: z.string().trim().min(1, "Give the copy a title.").max(300),
  includeSubtasks: z.boolean().default(true),
  /** Off reassigns every cloned subtask to you. */
  keepOwners: z.boolean().default(true),
  keepDueDates: z.boolean().default(false),
  /** On resets every cloned subtask to "not started" with both clocks cleared. */
  resetStatuses: z.boolean().default(true),
});

export type CloneInput = z.input<typeof cloneSchema>;

/**
 * Spec §6. History is never copied — a clone has not happened yet, so it starts
 * with an empty timeline and no clocks running.
 */
export async function cloneTask(
  id: string,
  input: CloneInput,
): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const parsed = cloneSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid clone options.");
    }
    const options = parsed.data;
    const supabase = await getDataClient();

    const { data: sourceData, error } = await supabase
      .from("tasks")
      .select("*, subtasks(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`cloneTask/read: ${error.message}`);
    if (!sourceData) return fail("That task no longer exists.");

    const source = sourceData as {
      description: string | null;
      label: string | null;
      priority: string;
      due_date: string | null;
      subtasks: SubtaskRow[] | null;
    };

    let fallbackOwnerId = "";
    if (!options.keepOwners) {
      const { data: self } = await supabase
        .from("contacts")
        .select("id")
        .eq("is_self", true)
        .limit(1)
        .maybeSingle();
      if (!self) {
        return fail(
          "No contact is marked as you, so subtasks cannot be reassigned. Set one on the Contacts page.",
        );
      }
      fallbackOwnerId = (self as { id: string }).id;
    }

    const clone = unwrap(
      await supabase
        .from("tasks")
        .insert({
          title: options.title,
          description: source.description,
          label: source.label,
          priority: source.priority,
          due_date: options.keepDueDates ? source.due_date : null,
          // A clone is fresh work: no manual status, nothing completed.
          manual_status: null,
          completed_at: null,
          sort_order: await nextTaskSortOrder(),
        })
        .select("id, title")
        .single(),
      "cloneTask",
    ) as { id: string; title: string };

    // Shared, tested clone rules — history is never copied.
    const cloned = cloneSubtasks(
      (source.subtasks ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({
          title: s.title,
          description: s.description,
          ownerId: s.owner_id,
          status: s.status,
          priority: s.priority,
          requestedDate: s.requested_date ? new Date(s.requested_date) : null,
          dueDate: s.due_date ? new Date(s.due_date) : null,
          completedAt: s.completed_at ? new Date(s.completed_at) : null,
          alertAfterDays: s.alert_after_days,
          sortOrder: s.sort_order,
          boardOrder: s.board_order,
        })),
      options,
      fallbackOwnerId,
    );

    if (cloned.length > 0) {
      const { error: insertError } = await supabase.from("subtasks").insert(
        cloned.map((s) => ({
          task_id: clone.id,
          title: s.title,
          description: s.description,
          owner_id: s.ownerId,
          status: s.status,
          priority: s.priority,
          requested_date: s.requestedDate?.toISOString() ?? null,
          due_date: s.dueDate?.toISOString() ?? null,
          completed_at: s.completedAt?.toISOString() ?? null,
          alert_after_days: s.alertAfterDays,
          sort_order: s.sortOrder,
          board_order: s.boardOrder,
        })),
      );
      if (insertError) throw new Error(`cloneTask/subtasks: ${insertError.message}`);

      // Keeping statuses can mean the clone lands already complete.
      if (!options.resetStatuses) await syncTaskCompletion(clone.id);
    }

    revalidateAll();
    return ok({ id: clone.id }, `Cloned as "${clone.title}".`);
  });
}
