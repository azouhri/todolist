import "../lib/load-env";

import { computeClocks } from "../lib/domain/clocks";
import { listContacts, listNeedsReminder, listTasks } from "../lib/domain/queries";
import { getDefaultOwnerId, getSettings } from "../lib/domain/settings";
import { applyStatusTransition } from "../lib/domain/transitions";
import { createServiceClient } from "../lib/supabase/data";
import { SUBTASK_COLUMNS, toColumns } from "../lib/supabase/rows";

/**
 * End-to-end check of the supabase-js data layer against the live project:
 * `npx tsx --tsconfig mcp/tsconfig.json scripts/verify-live.ts`
 *
 * Creates a temporary task, drives it through a status transition (the atomic
 * RPC), verifies the two clocks, then deletes it. Leaves no residue.
 */
let failures = 0;
const check = (label: string, pass: boolean, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "OK  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

async function main() {
  const supabase = createServiceClient();

  // ── reads ──────────────────────────────────────────────────────────────────
  const contacts = await listContacts();
  check("listContacts", contacts.length > 0, `${contacts.length} contacts`);

  const settings = await getSettings();
  check("getSettings", settings.defaultAlertAfterDays === 3, `alert after ${settings.defaultAlertAfterDays}d`);

  const defaultOwnerId = await getDefaultOwnerId();
  const defaultOwner = contacts.find((c) => c.id === defaultOwnerId);
  check("getDefaultOwnerId", Boolean(defaultOwner), defaultOwner?.name ?? "none");

  check("listTasks", Array.isArray(await listTasks()));
  check("listNeedsReminder", Array.isArray(await listNeedsReminder()));

  if (!defaultOwnerId) {
    console.log("\nNo owner available; skipping write checks.");
    return;
  }

  // ── writes ─────────────────────────────────────────────────────────────────
  const { data: taskRow, error: taskError } = await supabase
    .from("tasks")
    .insert({ title: "__verify__ temporary", priority: "high", sort_order: 999999 })
    .select("id")
    .single();
  check("create task", !taskError, taskError?.message ?? "");
  if (!taskRow) return;
  const taskId = (taskRow as { id: string }).id;

  try {
    // Requested 10 days ago so the waiting clock has something to measure.
    const requested = new Date(Date.now() - 10 * 86400_000);
    const { data: subRow, error: subError } = await supabase
      .from("subtasks")
      .insert({
        task_id: taskId,
        owner_id: defaultOwnerId,
        title: "__verify__ subtask",
        status: "waiting",
        requested_date: requested.toISOString(),
        sort_order: 1000,
        board_order: 1000,
      })
      .select("id")
      .single();
    check("create subtask", !subError, subError?.message ?? "");
    if (!subRow) return;
    const subtaskId = (subRow as { id: string }).id;

    // Embedded read: the shape every screen depends on.
    const tasks = await listTasks();
    const task = tasks.find((t) => t.id === taskId);
    check("embedded read (task -> subtasks -> owner)", Boolean(task?.subtasks[0]?.owner.name));
    check("task status roll-up", task?.status === "waiting", task?.status ?? "?");
    check(
      "daysWaiting computed",
      task?.subtasks[0]?.clocks.daysWaiting === 10,
      `${task?.subtasks[0]?.clocks.daysWaiting}d`,
    );
    check(
      "needsReminder (10d quiet > 3d cooldown)",
      task?.subtasks[0]?.clocks.needsReminder === true,
    );

    const reminders = await listNeedsReminder();
    check("appears in listNeedsReminder", reminders.some((r) => r.subtaskId === subtaskId));

    // The atomic RPC: status change + history event in one transaction.
    const transition = applyStatusTransition("waiting", "done", requested);
    const { error: rpcError } = await supabase.rpc("apply_subtask_transition", {
      p_subtask_id: subtaskId,
      p_patch: toColumns(transition.patch, SUBTASK_COLUMNS),
      p_event_type: transition.event?.type ?? null,
      p_event_note: transition.event?.note ?? null,
    });
    check("apply_subtask_transition RPC", !rpcError, rpcError?.message ?? "");

    const { data: after } = await supabase
      .from("subtasks")
      .select("status, completed_at, history:history_events(type, note)")
      .eq("id", subtaskId)
      .single();
    const row = after as {
      status: string;
      completed_at: string | null;
      history: { type: string; note: string | null }[];
    };
    check("status persisted", row.status === "done", row.status);
    check("completedAt stamped", Boolean(row.completed_at));
    check("history event written atomically", row.history.length === 1, `${row.history.length} event(s)`);

    // Reminder cooldown resets from the newest event; daysWaiting does not.
    const clocks = computeClocks(
      { status: "waiting", requestedDate: requested, history: [{ type: "reminder_sent", occurredAt: new Date() }] },
      settings.defaultAlertAfterDays,
    );
    check(
      "clocks stay independent",
      clocks.daysWaiting === 10 && clocks.needsReminder === false,
      `waiting ${clocks.daysWaiting}d, chase=${clocks.needsReminder}`,
    );

    // reindex RPC
    const { error: reindexError } = await supabase.rpc("reindex_orders", {
      p_table: "subtasks",
      p_column: "sort_order",
      p_orders: [{ id: subtaskId, order: 1000 }],
    });
    check("reindex_orders RPC", !reindexError, reindexError?.message ?? "");
  } finally {
    // Subtasks and history cascade with the task.
    await supabase.from("tasks").delete().eq("id", taskId);
    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("id", taskId);
    check("cleanup (cascade delete)", (count ?? 0) === 0);
  }

  console.log(failures === 0 ? "\nAll live checks passed." : `\n${failures} failure(s).`);
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
