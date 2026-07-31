"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { subtaskStatusSchema, toSubtaskStatus } from "@/lib/domain/enums";
import { needsReindex, nextSortOrder, reindexOrders } from "@/lib/domain/sort";
import { syncTaskCompletion } from "@/lib/domain/sync";
import { applyStatusTransition } from "@/lib/domain/transitions";
import { guarded } from "@/lib/server-action";
import { getDataClient } from "@/lib/supabase/data";
import { SUBTASK_COLUMNS, toColumns } from "@/lib/supabase/rows";

/**
 * Drops send the ids of the neighbours they landed between rather than a whole
 * ordering, so the server writes one row in the common case. When the two
 * neighbours get too close to split (spec §5.4) the list is silently reindexed
 * through a Postgres function, in one transaction.
 */

function revalidateAll() {
  revalidatePath("/", "layout");
}

type Neighbours = { prevId?: string | null; nextId?: string | null };

async function orderOf(
  table: "tasks" | "subtasks",
  column: "sort_order" | "board_order",
  id: string | null | undefined,
): Promise<number | undefined> {
  if (!id) return undefined;
  const supabase = await getDataClient();
  const { data } = await supabase.from(table).select(column).eq("id", id).maybeSingle();
  return (data as Record<string, number> | null)?.[column];
}

async function reindex(
  table: "tasks" | "subtasks",
  column: "sort_order" | "board_order",
  ids: string[],
) {
  const supabase = await getDataClient();
  const orders = [...reindexOrders(ids)].map(([id, order]) => ({ id, order }));
  const { error } = await supabase.rpc("reindex_orders", {
    p_table: table,
    p_column: column,
    p_orders: orders,
  });
  if (error) throw new Error(`reindex_orders: ${error.message}`);
}

export async function reorderTask(
  taskId: string,
  { prevId, nextId }: Neighbours,
): Promise<ActionResult> {
  return guarded(async () => {
    const supabase = await getDataClient();
    const [prev, next] = await Promise.all([
      orderOf("tasks", "sort_order", prevId),
      orderOf("tasks", "sort_order", nextId),
    ]);

    const { error } = await supabase
      .from("tasks")
      .update({ sort_order: nextSortOrder(prev, next) })
      .eq("id", taskId);
    if (error) throw new Error(`reorderTask: ${error.message}`);

    if (needsReindex(prev, next)) {
      const { data } = await supabase
        .from("tasks")
        .select("id")
        .order("sort_order", { ascending: true });
      await reindex("tasks", "sort_order", ((data ?? []) as { id: string }[]).map((t) => t.id));
    }

    revalidateAll();
    return ok(undefined);
  });
}

export async function reorderSubtask(
  subtaskId: string,
  { prevId, nextId }: Neighbours,
): Promise<ActionResult> {
  return guarded(async () => {
    const supabase = await getDataClient();

    const { data: current } = await supabase
      .from("subtasks")
      .select("task_id")
      .eq("id", subtaskId)
      .maybeSingle();
    if (!current) return fail("That subtask no longer exists.");

    const [prev, next] = await Promise.all([
      orderOf("subtasks", "sort_order", prevId),
      orderOf("subtasks", "sort_order", nextId),
    ]);

    const { error } = await supabase
      .from("subtasks")
      .update({ sort_order: nextSortOrder(prev, next) })
      .eq("id", subtaskId);
    if (error) throw new Error(`reorderSubtask: ${error.message}`);

    if (needsReindex(prev, next)) {
      const { data } = await supabase
        .from("subtasks")
        .select("id")
        .eq("task_id", (current as { task_id: string }).task_id)
        .order("sort_order", { ascending: true });
      await reindex(
        "subtasks",
        "sort_order",
        ((data ?? []) as { id: string }[]).map((s) => s.id),
      );
    }

    revalidateAll();
    return ok(undefined);
  });
}

/**
 * Kanban drop: sets board_order within the destination column and, when the
 * column changed, runs the same status transition an inline edit would — in a
 * single transaction with its history event.
 */
export async function moveSubtaskOnBoard(
  subtaskId: string,
  targetStatus: string,
  { prevId, nextId }: Neighbours,
): Promise<ActionResult<{ notice: string | null }>> {
  return guarded(async () => {
    const parsedStatus = subtaskStatusSchema.safeParse(targetStatus);
    if (!parsedStatus.success) return fail("Unknown column.");

    const supabase = await getDataClient();
    const { data, error } = await supabase
      .from("subtasks")
      .select("task_id, status, requested_date")
      .eq("id", subtaskId)
      .maybeSingle();
    if (error) throw new Error(`moveSubtaskOnBoard/read: ${error.message}`);
    if (!data) return fail("That subtask no longer exists.");

    const subtask = data as {
      task_id: string;
      status: string;
      requested_date: string | null;
    };

    const [prev, next] = await Promise.all([
      orderOf("subtasks", "board_order", prevId),
      orderOf("subtasks", "board_order", nextId),
    ]);

    const boardOrder = nextSortOrder(prev, next);
    const current = toSubtaskStatus(subtask.status);
    const statusChanged = current !== parsedStatus.data;

    const transition = statusChanged
      ? applyStatusTransition(
          current,
          parsedStatus.data,
          subtask.requested_date ? new Date(subtask.requested_date) : null,
        )
      : null;

    const patch = toColumns(
      { ...(transition?.patch ?? {}), boardOrder },
      SUBTASK_COLUMNS,
    );

    const { error: rpcError } = await supabase.rpc("apply_subtask_transition", {
      p_subtask_id: subtaskId,
      p_patch: patch,
      p_event_type: transition?.event?.type ?? null,
      p_event_note: transition?.event?.note ?? null,
    });
    if (rpcError) throw new Error(`applySubtaskTransition: ${rpcError.message}`);

    if (needsReindex(prev, next)) {
      const { data: column } = await supabase
        .from("subtasks")
        .select("id")
        .eq("status", parsedStatus.data)
        .order("board_order", { ascending: true });
      await reindex(
        "subtasks",
        "board_order",
        ((column ?? []) as { id: string }[]).map((s) => s.id),
      );
    }

    if (statusChanged) await syncTaskCompletion(subtask.task_id);

    revalidateAll();
    return ok({ notice: transition?.notice ?? null }, transition?.notice ?? undefined);
  });
}
