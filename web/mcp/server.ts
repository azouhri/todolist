import "../lib/load-env";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { formatDate } from "../lib/date";
import {
  historyEventTypeSchema,
  prioritySchema,
  subtaskStatusSchema,
  toSubtaskStatus,
} from "../lib/domain/enums";
import { listNeedsReminder, listSubtasksWithTask, listTasks } from "../lib/domain/queries";
import { getDefaultOwnerId } from "../lib/domain/settings";
import { ORDER_STEP } from "../lib/domain/sort";
import { syncTaskCompletion } from "../lib/domain/sync";
import { applyStatusTransition } from "../lib/domain/transitions";
import { createServiceClient } from "../lib/supabase/data";
import { SUBTASK_COLUMNS, toColumns } from "../lib/supabase/rows";

/**
 * Read/write access to the follow-up database from Claude Desktop.
 *
 * It reuses lib/domain, so the clocks, the roll-up and the status side effects
 * are exactly the ones the web UI applies — the two can never disagree.
 *
 * There is no signed-in user in this process, so it uses the Supabase service
 * role key and bypasses RLS. That is why it must stay local: the key is read
 * from .env.local and never leaves the machine.
 *
 * Transport is stdio; the process is started by Claude Desktop itself.
 * Never write to stdout here (it is the protocol channel) — use stderr.
 */

const server = new McpServer({ name: "follow-ups", version: "1.0.0" });

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

server.registerTool(
  "who_do_i_chase",
  {
    title: "Who do I chase today",
    description:
      "Lists the subtasks that are waiting on someone and have gone quiet for longer than their reminder cooldown. This is the answer to 'who owes me what and needs a nudge'.",
    inputSchema: {},
  },
  async () => {
    const items = await listNeedsReminder();
    if (items.length === 0) return text("Nothing to chase today.");

    const lines = items.map(
      (item) =>
        `- ${item.subtaskTitle} — ${item.ownerName} (task: ${item.taskTitle}) · waiting ${
          item.daysWaiting ?? "?"
        }d · quiet ${item.daysSinceLastContact ?? "?"}d · priority ${item.priority} · subtaskId=${item.subtaskId}`,
    );
    return text(`${items.length} to chase:\n${lines.join("\n")}`);
  },
);

server.registerTool(
  "list_tasks",
  {
    title: "List tasks",
    description:
      "Lists every task with its derived status, progress and how many subtasks need chasing.",
    inputSchema: {},
  },
  async () => {
    const tasks = await listTasks();
    if (tasks.length === 0) return text("No tasks yet.");

    return text(
      tasks
        .map(
          (task) =>
            `- ${task.title} [${task.status}] ${task.progress.done}/${task.progress.total} done` +
            (task.needsReminderCount > 0 ? ` · ${task.needsReminderCount} to chase` : "") +
            (task.dueDate ? ` · due ${formatDate(task.dueDate)}` : "") +
            ` · id=${task.id}`,
        )
        .join("\n"),
    );
  },
);

server.registerTool(
  "get_task",
  {
    title: "Get a task",
    description:
      "Full detail for one task: its subtasks, owners, both clocks and recent history.",
    inputSchema: { taskId: z.string().describe("The task id from list_tasks") },
  },
  async ({ taskId }) => {
    const tasks = await listTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return text(`No task with id ${taskId}.`);

    const subtasks = task.subtasks.map((subtask) => {
      const clocks = subtask.clocks;
      const bits = [
        `  · ${subtask.title} [${subtask.status}] owner=${subtask.owner.name}`,
        clocks.daysWaiting !== null ? `waiting ${clocks.daysWaiting}d` : null,
        clocks.daysSinceLastContact !== null
          ? `quiet ${clocks.daysSinceLastContact}d (chase after ${clocks.effectiveAlertAfterDays}d)`
          : null,
        clocks.needsReminder ? "NEEDS CHASING" : null,
        subtask.dueDate ? `due ${formatDate(subtask.dueDate)}` : null,
        `id=${subtask.id}`,
      ].filter(Boolean);

      const latest = subtask.history[0];
      return (
        bits.join(" · ") +
        (latest
          ? `\n      last event: ${latest.type} on ${formatDate(latest.occurredAt)}${
              latest.note ? ` — ${latest.note}` : ""
            }`
          : "")
      );
    });

    return text(
      `${task.title} [${task.status}] ${task.progress.done}/${task.progress.total} done\n` +
        (task.description ? `${task.description}\n` : "") +
        (subtasks.length ? subtasks.join("\n") : "  (no subtasks)"),
    );
  },
);

server.registerTool(
  "list_contacts",
  {
    title: "List contacts",
    description:
      "The people who can own subtasks, with the id to pass as ownerId. Marks which one is you and which is the default owner for new subtasks.",
    inputSchema: {},
  },
  async () => {
    const supabase = createServiceClient();
    const [{ data }, defaultOwnerId] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, name, team, is_self")
        .order("is_self", { ascending: false })
        .order("name", { ascending: true }),
      getDefaultOwnerId(),
    ]);

    const contacts = (data ?? []) as {
      id: string;
      name: string;
      team: string | null;
      is_self: boolean;
    }[];
    if (contacts.length === 0) return text("No contacts yet.");

    return text(
      contacts
        .map(
          (c) =>
            `- ${c.name}${c.is_self ? " (me)" : ""}${
              c.id === defaultOwnerId ? " (default owner)" : ""
            }${c.team ? ` · ${c.team}` : ""} · id=${c.id}`,
        )
        .join("\n"),
    );
  },
);

server.registerTool(
  "create_task",
  {
    title: "Create a task",
    description:
      "Creates a task — the outcome you want. Subtasks are the individual things people owe you towards it; add them with create_subtask.",
    inputSchema: {
      title: z.string(),
      description: z.string().optional(),
      label: z.string().optional(),
      priority: prioritySchema.default("medium"),
      dueDate: z
        .string()
        .optional()
        .describe("ISO date, e.g. 2026-08-15. Omit for no due date."),
    },
  },
  async ({ title, description, label, priority, dueDate }) => {
    const supabase = createServiceClient();

    const { data: last } = await supabase
      .from("tasks")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title,
        description: description ?? null,
        label: label ?? null,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        sort_order: ((last as { sort_order: number } | null)?.sort_order ?? 0) + ORDER_STEP,
      })
      .select("id, title")
      .single();

    if (error) return text(`Could not create the task: ${error.message}`);
    const task = data as { id: string; title: string };
    return text(`Created task "${task.title}" (id=${task.id}).`);
  },
);

server.registerTool(
  "create_subtask",
  {
    title: "Create a subtask",
    description:
      "Adds a subtask to a task — one thing one person owes you. The owner defaults to the configured default contact, and the requested date defaults to today, so the waiting clock starts immediately.",
    inputSchema: {
      taskId: z.string().describe("From list_tasks"),
      title: z.string(),
      ownerId: z
        .string()
        .optional()
        .describe("From list_contacts. Omit to use the default owner."),
      status: subtaskStatusSchema.default("waiting"),
      priority: prioritySchema.default("medium"),
      dueDate: z.string().optional().describe("ISO date. Omit for none."),
      requestedDate: z.string().optional().describe("ISO date. Omit to use today."),
    },
  },
  async ({ taskId, title, ownerId, status, priority, dueDate, requestedDate }) => {
    const supabase = createServiceClient();

    const { data: task } = await supabase
      .from("tasks")
      .select("title")
      .eq("id", taskId)
      .maybeSingle();
    if (!task) return text(`No task with id ${taskId}.`);

    const owner = ownerId ?? (await getDefaultOwnerId());
    if (!owner) {
      return text("No contact to own this subtask. Add one on the Contacts page.");
    }

    const { data: ownerRow } = await supabase
      .from("contacts")
      .select("name")
      .eq("id", owner)
      .maybeSingle();
    if (!ownerRow) return text(`No contact with id ${owner}.`);

    const { data: last } = await supabase
      .from("subtasks")
      .select("sort_order, board_order")
      .eq("task_id", taskId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const tail = last as { sort_order: number; board_order: number } | null;

    const { data, error } = await supabase
      .from("subtasks")
      .insert({
        task_id: taskId,
        title,
        owner_id: owner,
        status,
        priority,
        requested_date: (requestedDate ? new Date(requestedDate) : new Date()).toISOString(),
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        sort_order: (tail?.sort_order ?? 0) + ORDER_STEP,
        board_order: (tail?.board_order ?? 0) + ORDER_STEP,
      })
      .select("id, title")
      .single();

    if (error) return text(`Could not add the subtask: ${error.message}`);
    const subtask = data as { id: string; title: string };
    await syncTaskCompletion(taskId);

    return text(
      `Added "${subtask.title}" to "${(task as { title: string }).title}", owned by ${
        (ownerRow as { name: string }).name
      }, status ${status} (id=${subtask.id}).`,
    );
  },
);

server.registerTool(
  "log_reminder",
  {
    title: "Log a follow-up event",
    description:
      "Records an event on a subtask's timeline — for example that you chased someone. A reminder resets the cooldown but not the waiting clock.",
    inputSchema: {
      subtaskId: z.string(),
      type: historyEventTypeSchema.default("reminder_sent"),
      note: z.string().optional().describe("What happened"),
    },
  },
  async ({ subtaskId, type, note }) => {
    const supabase = createServiceClient();

    const { data: subtask } = await supabase
      .from("subtasks")
      .select("title")
      .eq("id", subtaskId)
      .maybeSingle();
    if (!subtask) return text(`No subtask with id ${subtaskId}.`);

    const { error } = await supabase
      .from("history_events")
      .insert({ subtask_id: subtaskId, type, note: note ?? null });
    if (error) return text(`Could not log the event: ${error.message}`);

    return text(
      `Logged "${type}" on "${(subtask as { title: string }).title}". Reminder cooldown reset.`,
    );
  },
);

server.registerTool(
  "set_subtask_status",
  {
    title: "Change a subtask status",
    description:
      "Moves a subtask to a new status, applying the same clock rules as the app (entering 'waiting' starts the waiting clock, 'done' stamps completion, 'not_started' clears both).",
    inputSchema: {
      subtaskId: z.string(),
      status: subtaskStatusSchema,
    },
  },
  async ({ subtaskId, status }) => {
    const supabase = createServiceClient();

    const { data } = await supabase
      .from("subtasks")
      .select("task_id, title, status, requested_date")
      .eq("id", subtaskId)
      .maybeSingle();
    if (!data) return text(`No subtask with id ${subtaskId}.`);

    const subtask = data as {
      task_id: string;
      title: string;
      status: string;
      requested_date: string | null;
    };

    const current = toSubtaskStatus(subtask.status);
    if (current === status) return text(`"${subtask.title}" is already ${status}.`);

    const { patch, event, notice } = applyStatusTransition(
      current,
      status,
      subtask.requested_date ? new Date(subtask.requested_date) : null,
    );

    // One transaction: the status and its history event must not split.
    const { error } = await supabase.rpc("apply_subtask_transition", {
      p_subtask_id: subtaskId,
      p_patch: toColumns(patch, SUBTASK_COLUMNS),
      p_event_type: event?.type ?? null,
      p_event_note: event?.note ?? null,
    });
    if (error) return text(`Could not change the status: ${error.message}`);

    await syncTaskCompletion(subtask.task_id);
    return text(`"${subtask.title}": ${current} → ${status}.${notice ? ` ${notice}` : ""}`);
  },
);

server.registerTool(
  "waiting_on_summary",
  {
    title: "Waiting on whom",
    description:
      "Groups everything you are currently waiting for by the person who owes it.",
    inputSchema: {},
  },
  async () => {
    const subtasks = await listSubtasksWithTask();
    const waiting = subtasks.filter((s) => s.status === "waiting");
    if (waiting.length === 0) return text("You are not waiting on anyone.");

    const byOwner = new Map<string, typeof waiting>();
    for (const subtask of waiting) {
      const list = byOwner.get(subtask.owner.name) ?? [];
      list.push(subtask);
      byOwner.set(subtask.owner.name, list);
    }

    return text(
      [...byOwner.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([owner, items]) => {
          const oldest = Math.max(...items.map((i) => i.clocks.daysWaiting ?? 0));
          const chase = items.filter((i) => i.clocks.needsReminder).length;
          return (
            `- ${owner}: ${items.length} open · oldest ${oldest}d` +
            (chase > 0 ? ` · ${chase} to chase` : "") +
            items.map((i) => `\n    · ${i.title} (${i.task.title})`).join("")
          );
        })
        .join("\n"),
    );
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("follow-ups MCP server ready on stdio");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
