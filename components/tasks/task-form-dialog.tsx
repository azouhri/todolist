"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createTask, updateTask, type TaskInput } from "@/app/actions/tasks";
import { OptionSelect, optionsFrom } from "@/components/common/option-select";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { fromDateInputValue, toDateInputValue } from "@/lib/date";
import { PRIORITIES, PRIORITY_LABELS, type Priority } from "@/lib/domain/enums";

export type TaskFormValues = {
  id?: string;
  title: string;
  description: string;
  label: string;
  priority: Priority;
  dueDate: string;
};

export function emptyTaskForm(): TaskFormValues {
  return {
    title: "",
    description: "",
    label: "",
    priority: "medium",
    dueDate: "",
  };
}

export function taskFormFrom(task: {
  id: string;
  title: string;
  description: string | null;
  label: string | null;
  priority: Priority;
  dueDate: Date | null;
}): TaskFormValues {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    label: task.label ?? "",
    priority: task.priority,
    dueDate: toDateInputValue(task.dueDate),
  };
}

export function TaskFormDialog({
  open,
  onOpenChange,
  initial,
  /** Navigate to the new task after creating it. */
  navigateOnCreate = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: TaskFormValues;
  navigateOnCreate?: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [lastKey, setLastKey] = useState(initial.id ?? "new");
  const { run, isPending } = useAction();
  const router = useRouter();

  const key = initial.id ?? "new";
  if (open && key !== lastKey) {
    setLastKey(key);
    setForm(initial);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload: TaskInput = {
      title: form.title,
      description: form.description,
      label: form.label,
      priority: form.priority,
      dueDate: fromDateInputValue(form.dueDate),
    };

    if (form.id) {
      const id = form.id;
      run(() => updateTask(id, payload), {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      run(() => createTask(payload), {
        onSuccess: (data) => {
          onOpenChange(false);
          setForm(emptyTaskForm());
          if (navigateOnCreate) router.push(`/tasks/${data.id}`);
        },
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit task" : "New task"}</DialogTitle>
            <DialogDescription>
              A task is the outcome you want. Subtasks are the things people owe
              you to get there.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ship the Q3 compliance report"
                autoFocus
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="task-label">Label</Label>
                <Input
                  id="task-label"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Compliance"
                />
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <OptionSelect
                  value={form.priority}
                  onChange={(priority) => setForm({ ...form, priority })}
                  options={optionsFrom(PRIORITIES, PRIORITY_LABELS)}
                  ariaLabel="Task priority"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="task-due">Due date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
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
              {form.id ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
