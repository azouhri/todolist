"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { exportToExcel } from "@/app/actions/export";
import { OptionSelect, optionsFrom } from "@/components/common/option-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAction } from "@/hooks/use-action";
import {
  EXPORT_SCOPES,
  EXPORT_SCOPE_LABELS,
  OPTIONAL_COLUMNS,
  OPTIONAL_COLUMN_LABELS,
  type ExportScope,
  type OptionalColumn,
} from "@/lib/export/columns";

/** Turns the base64 workbook into a download without leaving the page. */
function save(filename: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [scope, setScope] = useState<ExportScope>("open");
  const [columns, setColumns] = useState<OptionalColumn[]>(["dates", "clocks"]);
  const { run, isPending } = useAction();

  function toggle(column: OptionalColumn, checked: boolean) {
    setColumns((current) =>
      checked ? [...current, column] : current.filter((c) => c !== column),
    );
  }

  function handleExport() {
    toast.info("Building the spreadsheet…");
    run(() => exportToExcel(scope, columns), {
      success: (data) => `Exported ${data.rowCount} subtasks.`,
      onSuccess: (data) => {
        save(data.filename, data.content);
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export to Excel</DialogTitle>
          <DialogDescription>
            One row per subtask, with its task&apos;s columns repeated.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Include</Label>
            <OptionSelect
              value={scope}
              onChange={setScope}
              options={optionsFrom(EXPORT_SCOPES, EXPORT_SCOPE_LABELS)}
              ariaLabel="Export scope"
            />
          </div>

          <div className="grid gap-2">
            <Label>Extra columns</Label>
            {OPTIONAL_COLUMNS.map((column) => (
              <label key={column} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={columns.includes(column)}
                  onCheckedChange={(checked) => toggle(column, checked === true)}
                />
                {OPTIONAL_COLUMN_LABELS[column]}
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="outline">
                Cancel
              </Button>
            }
          />
          <Button onClick={handleExport} disabled={isPending}>
            <DownloadIcon /> Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Convenience trigger for the tasks page header. */
export function ExportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <DownloadIcon /> Export
      </Button>
      <ExportDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
