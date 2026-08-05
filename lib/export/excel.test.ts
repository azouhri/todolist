import ExcelJS from "exceljs";
import { subDays } from "date-fns";
import { describe, expect, it } from "vitest";

import { computeClocks } from "@/lib/domain/clocks";
import type { EnrichedSubtask, EnrichedTask } from "@/lib/domain/queries";

import { buildWorkbook } from "./excel";

const TODAY = new Date("2026-07-30T12:00:00Z");

function fixture(): EnrichedTask {
  const subtask = {
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
    isFocused: false,
    isArchived: false,
    createdAt: TODAY,
    updatedAt: TODAY,
    owner: { id: "c1", name: "Priya Raman", email: null, isSelf: false },
    history: [],
  };

  const enriched = {
    ...subtask,
    clocks: computeClocks(
      { status: subtask.status, requestedDate: subtask.requestedDate, history: [] },
      3,
      TODAY,
    ),
  } as EnrichedSubtask;

  return {
    id: "t1",
    title: "Close the Q3 security audit",
    description: null,
    label: "Compliance",
    priority: "high",
    manualStatus: null,
    dueDate: null,
    completedAt: null,
    sortOrder: 1000,
    createdAt: TODAY,
    updatedAt: TODAY,
    subtasks: [enriched],
    status: "waiting",
    progress: { done: 0, total: 1, percent: 0 },
    needsReminderCount: 1,
  };
}

/** Round-trips real .xlsx bytes rather than trusting the row builder alone. */
async function readBack(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

describe("buildWorkbook", () => {
  it("produces a readable workbook with a Follow-ups sheet", async () => {
    const workbook = await readBack(await buildWorkbook([fixture()], "all", []));
    expect(workbook.getWorksheet("Follow-ups")).toBeDefined();
  });

  it("writes the headers and one row per subtask", async () => {
    const workbook = await readBack(await buildWorkbook([fixture()], "all", []));
    const sheet = workbook.getWorksheet("Follow-ups")!;

    const headers = sheet.getRow(1).values as string[];
    expect(headers).toContain("Task");
    expect(headers).toContain("Subtask");
    expect(headers).toContain("Owner");

    expect(sheet.rowCount).toBe(2); // header + one subtask
    expect(sheet.getRow(2).getCell(4).value).toBe("Signed vendor DPA");
    expect(sheet.getRow(2).getCell(5).value).toBe("Priya Raman");
  });

  it("adds the optional clock columns when requested", async () => {
    const workbook = await readBack(
      await buildWorkbook([fixture()], "all", ["clocks"]),
    );
    const sheet = workbook.getWorksheet("Follow-ups")!;
    const headers = sheet.getRow(1).values as string[];

    expect(headers).toContain("Days waiting");
    expect(headers).toContain("Needs reminder");
    expect(sheet.getRow(2).getCell(headers.indexOf("Days waiting")).value).toBe(12);
  });

  it("writes only the header when the scope matches nothing", async () => {
    const workbook = await readBack(
      await buildWorkbook([fixture()], "needs_reminder", []),
    );
    // The fixture needs a reminder, so flip to a scope it cannot satisfy.
    expect(workbook.getWorksheet("Follow-ups")!.rowCount).toBe(2);

    const empty = await readBack(await buildWorkbook([], "all", []));
    expect(empty.getWorksheet("Follow-ups")!.rowCount).toBe(1);
  });
});
