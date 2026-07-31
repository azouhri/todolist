import "../lib/load-env";

import { readFileSync } from "node:fs";
import path from "node:path";

import { createServiceClient } from "../lib/supabase/data";

/**
 * Replays the SQLite-era export into Supabase: `npm run db:import`.
 *
 * Safe to re-run: rows are upserted by their original id, so ids, dates and
 * both clocks survive the move unchanged. Insert order follows the foreign keys
 * (contacts → tasks → subtasks → history → settings, which points at a contact).
 *
 * The export is camelCase (it came from Prisma); the columns are snake_case.
 */
type Row = Record<string, unknown>;

const iso = (value: unknown): string | null =>
  typeof value === "string" && value ? value : null;

async function main() {
  const file = path.join(process.cwd(), "data", "data-export.json");
  const data = JSON.parse(readFileSync(file, "utf8"));
  const supabase = createServiceClient();

  console.log(`Importing ${file} (exported ${data.exportedAt})`);

  const upsert = async (table: string, rows: Row[]) => {
    if (rows.length === 0) return;
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
  };

  await upsert(
    "contacts",
    (data.contacts ?? []).map((c: Row) => ({
      id: c.id,
      name: c.name,
      email: c.email ?? null,
      team: c.team ?? null,
      notes: c.notes ?? null,
      is_self: Boolean(c.isSelf),
      created_at: iso(c.createdAt),
      updated_at: iso(c.updatedAt),
    })),
  );

  await upsert(
    "tasks",
    (data.tasks ?? []).map((t: Row) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? null,
      label: t.label ?? null,
      priority: t.priority ?? "medium",
      manual_status: t.manualStatus ?? null,
      due_date: iso(t.dueDate),
      completed_at: iso(t.completedAt),
      sort_order: t.sortOrder ?? 0,
      created_at: iso(t.createdAt),
      updated_at: iso(t.updatedAt),
    })),
  );

  await upsert(
    "subtasks",
    (data.subtasks ?? []).map((s: Row) => ({
      id: s.id,
      task_id: s.taskId,
      owner_id: s.ownerId,
      title: s.title,
      description: s.description ?? null,
      status: s.status ?? "not_started",
      priority: s.priority ?? "medium",
      requested_date: iso(s.requestedDate),
      due_date: iso(s.dueDate),
      completed_at: iso(s.completedAt),
      alert_after_days: s.alertAfterDays ?? null,
      sort_order: s.sortOrder ?? 0,
      board_order: s.boardOrder ?? 0,
      created_at: iso(s.createdAt),
      updated_at: iso(s.updatedAt),
    })),
  );

  await upsert(
    "history_events",
    (data.history ?? []).map((h: Row) => ({
      id: h.id,
      subtask_id: h.subtaskId,
      type: h.type,
      note: h.note ?? null,
      occurred_at: iso(h.occurredAt),
      created_at: iso(h.createdAt),
    })),
  );

  await upsert(
    "app_settings",
    (data.settings ?? []).map((s: Row) => ({
      id: s.id,
      default_alert_after_days: s.defaultAlertAfterDays ?? 3,
      default_owner_id: s.defaultOwnerId ?? null,
      updated_at: iso(s.updatedAt),
    })),
  );

  for (const table of ["contacts", "tasks", "subtasks", "history_events"]) {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true });
    console.log(`${table}: ${count ?? 0}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
