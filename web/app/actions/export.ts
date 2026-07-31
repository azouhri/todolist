"use server";

import { format } from "date-fns";

import { ok, type ActionResult } from "@/lib/action-result";
import { guarded } from "@/lib/server-action";
import { listTasks } from "@/lib/domain/queries";
import type { ExportScope, OptionalColumn } from "@/lib/export/columns";
import { buildWorkbook } from "@/lib/export/excel";

export type ExportResult = {
  filename: string;
  /** base64 so the workbook can cross the server-action boundary. */
  content: string;
  rowCount: number;
};

/**
 * Builds the workbook on the server and hands it back for the browser to save.
 * Local single-user app, so there is no file to clean up afterwards.
 */
export async function exportToExcel(
  scope: ExportScope,
  optional: OptionalColumn[],
): Promise<ActionResult<ExportResult>> {
  return guarded(async () => {
    const tasks = await listTasks();
    const buffer = await buildWorkbook(tasks, scope, optional);

    const rowCount = tasks.reduce((sum, task) => sum + task.subtasks.length, 0);
    const filename = `follow-ups-${format(new Date(), "yyyy-MM-dd")}.xlsx`;

    return ok(
      { filename, content: buffer.toString("base64"), rowCount },
      "Export ready.",
    );
  }, "Could not build the spreadsheet.");
}
