import { subDays } from "date-fns";
import { describe, expect, it } from "vitest";

import { computeClocks } from "@/lib/domain/clocks";
import type { EnrichedSubtask, EnrichedTask } from "@/lib/domain/queries";

import { buildColumns, buildRows, type OptionalColumn } from "./columns";

const TODAY = new Date("2026-07-30T12:00:00Z");

function subtask(overrides: Partial<EnrichedSubtask> = {}): EnrichedSubtask {
  const base = {
    id: "s1",
    taskId: "t1",
    title: "Signed vendor DPA",
    description: null,
    status: "waiting" as const,
    priority: "high" as const,
    requestedDate: subDays(TODAY, 12),
    dueDate: null,
    completedAt: null,
    alertAfterDays: null,
    sortOrder: 1000,
    boardOrder: 1000,
    createdAt: TODAY,
    updatedAt: TODAY,
    owner: { id: "c1", name: "Priya Raman", email: null, isSelf: false },
    history: [],
    ...overrides,
  };

  return {
    ...base,
    clocks: computeClocks(
      {
        status: base.status,
        requestedDate: base.requestedDate,
        dueDate: base.dueDate,
        alertAfterDays: base.alertAfterDays,
        history: base.history,
      },
      3,
      TODAY,
    ),
  } as EnrichedSubtask;
}

function task(subtasks: EnrichedSubtask[]): EnrichedTask {
  return {
    id: "t1",
    title: "Close the Q3 security audit",
    description: "Everything the auditor still needs.",
    label: "Compliance",
    priority: "high",
    manualStatus: null,
    dueDate: null,
    completedAt: null,
    sortOrder: 1000,
    createdAt: TODAY,
    updatedAt: TODAY,
    subtasks,
    status: "waiting",
    progress: { done: 0, total: subtasks.length, percent: 0 },
    needsReminderCount: subtasks.filter((s) => s.clocks.needsReminder).length,
  };
}

describe("buildColumns", () => {
  it("emits the base columns in the documented order", () => {
    expect(buildColumns([]).map((c) => c.key)).toEqual([
      "taskTitle",
      "taskStatus",
      "label",
      "subtaskTitle",
      "owner",
      "status",
      "priority",
    ]);
  });

  it("appends optional groups in a stable order regardless of input order", () => {
    const a = buildColumns(["clocks", "description"]).map((c) => c.key);
    const b = buildColumns(["description", "clocks"]).map((c) => c.key);
    expect(a).toEqual(b);
    // description comes before clocks in the canonical order
    expect(a.indexOf("taskDescription")).toBeLessThan(a.indexOf("daysWaiting"));
  });

  it("adds every column of a selected group", () => {
    const keys = buildColumns(["dates"]).map((c) => c.key);
    expect(keys).toContain("requestedDate");
    expect(keys).toContain("dueDate");
    expect(keys).toContain("completedAt");
  });
});

describe("buildRows", () => {
  const rows = (scope: Parameters<typeof buildRows>[1], optional: OptionalColumn[] = []) =>
    buildRows([task([subtask(), subtask({ id: "s2", status: "done" })])], scope, optional);

  it("emits one row per subtask with the task columns repeated", () => {
    const result = rows("all");
    expect(result).toHaveLength(2);
    expect(result[0]!.taskTitle).toBe("Close the Q3 security audit");
    expect(result[1]!.taskTitle).toBe("Close the Q3 security audit");
  });

  it("uses display labels, not raw enum values", () => {
    const [first] = rows("all");
    expect(first!.status).toBe("Waiting");
    expect(first!.priority).toBe("High");
    expect(first!.taskStatus).toBe("Waiting");
  });

  it("drops closed subtasks for the open scope", () => {
    expect(rows("open")).toHaveLength(1);
  });

  it("keeps only waiting subtasks for the waiting scope", () => {
    const result = rows("waiting");
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe("Waiting");
  });

  it("keeps only subtasks that need chasing for the reminder scope", () => {
    const result = rows("needs_reminder");
    expect(result).toHaveLength(1);
  });

  it("omits optional fields that were not requested", () => {
    const [first] = rows("all");
    expect(first).not.toHaveProperty("daysWaiting");
    expect(first).not.toHaveProperty("requestedDate");
  });

  it("includes the clock columns when asked", () => {
    const [first] = rows("all", ["clocks"]);
    expect(first!.daysWaiting).toBe(12);
    expect(first!.needsReminder).toBe("Yes");
    expect(first!.alertAfterDays).toBe(3);
  });

  it("reports the latest history event", () => {
    const withHistory = buildRows(
      [
        task([
          subtask({
            history: [
              { id: "h2", type: "reminder_sent", note: "Nudged", occurredAt: subDays(TODAY, 1) },
              { id: "h1", type: "requested", note: "Asked", occurredAt: subDays(TODAY, 12) },
            ],
          }),
        ]),
      ],
      "all",
      ["history"],
    );

    expect(withHistory[0]!.lastEvent).toBe("Reminder sent");
    expect(withHistory[0]!.lastEventNote).toBe("Nudged");
  });
});
