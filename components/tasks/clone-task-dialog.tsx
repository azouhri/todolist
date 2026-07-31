"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cloneTask, type CloneInput } from "@/app/actions/tasks";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

type Options = Required<CloneInput>;

function defaults(title: string): Options {
  return {
    title: `Copy of ${title}`,
    includeSubtasks: true,
    keepOwners: true,
    keepDueDates: false,
    resetStatuses: true,
  };
}

function OptionRow({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-accent/40",
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next === true)}
        className="mt-0.5"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

export function CloneTaskDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: { id: string; title: string; subtaskCount: number };
}) {
  const [options, setOptions] = useState<Options>(() => defaults(task.title));
  const [lastKey, setLastKey] = useState(task.id);
  const { run, isPending } = useAction();
  const router = useRouter();

  if (open && task.id !== lastKey) {
    setLastKey(task.id);
    setOptions(defaults(task.title));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    run(() => cloneTask(task.id, options), {
      onSuccess: (data) => {
        onOpenChange(false);
        router.push(`/tasks/${data.id}`);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Clone task</DialogTitle>
            <DialogDescription>
              History is never copied — the clone starts with an empty timeline
              and no clocks running.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="clone-title">New title</Label>
              <Input
                id="clone-title"
                value={options.title}
                onChange={(e) =>
                  setOptions({ ...options, title: e.target.value })
                }
                autoFocus
                required
              />
            </div>

            <div className="grid gap-2">
              <OptionRow
                checked={options.includeSubtasks}
                onChange={(includeSubtasks) =>
                  setOptions({ ...options, includeSubtasks })
                }
                label={`Copy subtasks (${task.subtaskCount})`}
                hint="Bring the same list of things people owe you."
              />
              <OptionRow
                checked={options.resetStatuses}
                onChange={(resetStatuses) =>
                  setOptions({ ...options, resetStatuses })
                }
                disabled={!options.includeSubtasks}
                label="Reset statuses"
                hint="Every subtask starts at Not started with both clocks cleared."
              />
              <OptionRow
                checked={options.keepOwners}
                onChange={(keepOwners) => setOptions({ ...options, keepOwners })}
                disabled={!options.includeSubtasks}
                label="Keep owners"
                hint="Off assigns every copied subtask to you."
              />
              <OptionRow
                checked={options.keepDueDates}
                onChange={(keepDueDates) =>
                  setOptions({ ...options, keepDueDates })
                }
                label="Keep due dates"
                hint="Off clears due dates on the task and its subtasks."
              />
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
            <Button type="submit" disabled={isPending}>
              Clone task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
