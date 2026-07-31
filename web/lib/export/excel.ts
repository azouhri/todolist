import "server-only";

import ExcelJS from "exceljs";

import type { EnrichedTask } from "@/lib/domain/queries";

import {
  buildColumns,
  buildRows,
  type ExportScope,
  type OptionalColumn,
} from "./columns";

/**
 * Writes the workbook. The column vocabulary lives in ./columns so the export
 * dialog can share it without pulling exceljs into the client bundle.
 */
export async function buildWorkbook(
  tasks: readonly EnrichedTask[],
  scope: ExportScope,
  optional: readonly OptionalColumn[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Follow-ups");
  sheet.columns = buildColumns(optional).map((c) => ({
    key: c.key,
    header: c.header,
    width: c.width,
  }));

  sheet.addRows(buildRows(tasks, scope, optional));

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
