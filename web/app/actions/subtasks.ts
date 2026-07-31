"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  historyEventTypeSchema,
  prioritySchema,
  subtaskStatusSchema,
  toSubtaskStatus,
} from "@/lib/domain/enums";
import { ORDER_STEP } from "@/lib/domain/sort";
import { syncTaskCompletion } from "@/lib/domain/sync";
import { applyStatusTransition } from "@/lib/domain/transitions";
import { guarded } from "@/lib/server-action";
import { getDataClient, unwrap } from "@/lib/supabase/data";
import { SUBTASK_COLUMNS, toColumns } from "@/lib/supabase/rows";

function revalidateAll() {
  // Every surface shows roll-ups or clocks derived from subtasks.
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

const createSubtaskSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(1, "Give the subtask a title.").max(300),
  ownerId: z.string().min(1, "Pick an owner."),
  status: subtaskStatusSchema.default("not_started"),
  priority: prioritySchema.default("medium"),
  description: z.string().trim().max(2000).optional(),
  requestedDate: optionalDate,
  dueDate: optionalDate,
  alertAfterDays: z.number().int().min(0).max(365).nullable().optional(),
});

export type CreateSubtaskInput = z.input<typeof createSubtaskSchema>;

export async function createSubtask(
  input: CreateSubtaskInput,
): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const parsed = createSubtaskSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid subtask.");
    }
    const data = parsed.data;
    const supabase = await getDataClient();

    const { data: last } = await supabase
      .from("subtasks")
      .select("sort_order, board_order")
      .eq("task_id", data.taskId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const tail = last as { sort_order: number; board_order: number } | null;

    const subtask = unwrap(
      await supabase
        .from("subtasks")
        .insert({
          task_id: data.taskId,
          title: data.title,
          owner_id: data.ownerId,
          status: data.status,
          priority: data.priority,
          description: data.description || null,
          // Default the requested date to the day it was created, so the
          // waiting clock is already correct without anyone typing a date.
          requested_date: (data.requestedDate ?? new Date()).toISOString(),
          due_date: data.dueDate?.toISOString() ?? null,
          alert_after_days: data.alertAfterDays ?? null,
          sort_order: (tail?.sort_order ?? 0) + ORDER_STEP,
          board_order: (tail?.board_order ?? 0) + ORDER_STEP,
        })
        .select("id")
        .single(),
      "createSubtask",
    ) as { id: string };

    await syncTaskCompletion(data.taskId);
    revalidateAll();
    return ok({ id: subtask.id }, "Subtask added.");
  });
}

const updateSubtaskSchema = z.object({
  title: z.string().trim().min(1, "Give the subtask a title.").max(300).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  ownerId: z.string().min(1).optional(),
  priority: prioritySchema.optional(),
  requestedDate: optionalDate,
  dueDate: optionalDate,
  alertAfterDays: z.number().int().min(0).max(365).nullable().optional(),
});

export type UpdateSubtaskInput = z.input<typeof updateSubtaskSchema>;

/** Field edits only — status goes through changeSubtaskStatus. */
export async function updateSubtask(
  id: string,
  input: UpdateSubtaskInput,
): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = updateSubtaskSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid subtask.");
    }

    // Only send keys the caller actually provided. The date fields parse to
    // null rather than undefined, so without this an edit to the title alone
    // would wipe requestedDate and dueDate.
    const provided: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (Object.prototype.hasOwnProperty.call(input, key)) provided[key] = value;
    }
    if (Object.keys(provided).length === 0) return ok(undefined);

    const supabase = await getDataClient();
    const subtask = unwrap(
      await supabase
        .from("subtasks")
        .update(toColumns(provided, SUBTASK_COLUMNS))
        .eq("id", id)
        .select("task_id")
        .single(),
      "updateSubtask",
    ) as { task_id: string };

    await syncTaskCompletion(subtask.task_id);
    revalidateAll();
    return ok(undefined, "Subtask saved.");
  });
}

export async function changeSubtaskStatus(
  id: string,
  nextStatus: string,
): Promise<ActionResult<{ notice: string | null }>> {
  return guarded(async () => {
    const parsedStatus = subtaskStatusSchema.safeParse(nextStatus);
    if (!parsedStatus.success) return fail("Unknown status.");

    const supabase = await getDataClient();
    const { data, error } = await supabase
      .from("subtasks")
      .select("id, task_id, status, requested_date")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`changeSubtaskStatus/read: ${error.message}`);
    if (!data) return fail("That subtask no longer exists.");

    const subtask = data as {
      task_id: string;
      status: string;
      requested_date: string | null;
    };

    const current = toSubtaskStatus(subtask.status);
    if (current === parsedStatus.data) return ok({ notice: null });

    const { patch, event, notice } = applyStatusTransition(
      current,
      parsedStatus.data,
      subtask.requested_date ? new Date(subtask.requested_date) : null,
    );

    // One transaction: a status change without its history event would leave
    // the waiting clock and the reminder cooldown disagreeing.
    const { error: rpcError } = await supabase.rpc("apply_subtask_transition", {
      p_subtask_id: id,
      p_patch: toColumns(patch, SUBTASK_COLUMNS),
      p_event_type: event?.type ?? null,
      p_event_note: event?.note ?? null,
    });
    if (rpcError) throw new Error(`applySubtaskTransition: ${rpcError.message}`);

    await syncTaskCompletion(subtask.task_id);
    revalidateAll();
    return ok({ notice }, notice ?? "Status updated.");
  });
}

export async function deleteSubtask(id: string): Promise<ActionResult> {
  return guarded(async () => {
    const supabase = await getDataClient();

    const { data, error } = await supabase
      .from("subtasks")
      .select("task_id, title")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`deleteSubtask/read: ${error.message}`);
    if (!data) return fail("That subtask no longer exists.");
    const subtask = data as { task_id: string; title: string };

    // History cascades with the subtask.
    const { error: deleteError } = await supabase
      .from("subtasks")
      .delete()
      .eq("id", id);
    if (deleteError) throw new Error(`deleteSubtask: ${deleteError.message}`);

    await syncTaskCompletion(subtask.task_id);
    revalidateAll();
    return ok(undefined, `Deleted "${subtask.title}".`);
  });
}

const historySchema = z.object({
  type: historyEventTypeSchema,
  note: z.string().trim().max(2000).optional(),
  occurredAt: optionalDate,
});

export type HistoryInput = z.input<typeof historySchema>;

/**
 * Logging an event resets the reminder cooldown (it is measured from the newest
 * event) without touching daysWaiting, which runs from requestedDate.
 */
export async function addHistoryEvent(
  subtaskId: string,
  input: HistoryInput,
): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = historySchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid event.");
    }

    const supabase = await getDataClient();
    const { error } = await supabase.from("history_events").insert({
      subtask_id: subtaskId,
      type: parsed.data.type,
      note: parsed.data.note || null,
      occurred_at: (parsed.data.occurredAt ?? new Date()).toISOString(),
    });

    // A missing subtask trips the foreign key rather than a lookup round-trip.
    if (error) {
      return fail(
        error.message.includes("foreign key")
          ? "That subtask no longer exists."
          : error.message,
      );
    }

    revalidateAll();
    return ok(undefined, "Event logged.");
  });
}

export async function deleteHistoryEvent(id: string): Promise<ActionResult> {
  return guarded(async () => {
    const supabase = await getDataClient();
    const { error } = await supabase.from("history_events").delete().eq("id", id);
    if (error) throw new Error(`deleteHistoryEvent: ${error.message}`);

    revalidateAll();
    return ok(undefined, "Event removed.");
  });
}
