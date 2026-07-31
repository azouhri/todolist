"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  CopyIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { reorderTask } from "@/app/actions/ordering";
import { deleteTask } from "@/app/actions/tasks";
import { OverdueBadge, PriorityBadge, ReminderBadge, StatusBadge } from "@/components/common/badges";
import { OptionSelect, optionsFrom, type Option } from "@/components/common/option-select";
import { SortableRow, VerticalSortable, neighboursOf } from "@/components/common/sortable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ExportButton } from "@/components/export/export-dialog";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/date";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type Priority,
  type TaskStatus,
} from "@/lib/domain/enums";
import { cn } from "@/lib/utils";

import { CloneTaskDialog } from "./clone-task-dialog";
import {
  TaskFormDialog,
  emptyTaskForm,
  taskFormFrom,
  type TaskFormValues,
} from "./task-form-dialog";

export type TaskListItem = {
  id: string;
  title: string;
  description: string | null;
  label: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: Date | null;
  updatedAt: Date;
  progress: { done: number; total: number; percent: number };
  needsReminderCount: number;
  /** Subtasks past their own due date. */
  overdueCount: number;
  /** The task's own due date has passed and it is not finished. */
  isOverdue: boolean;
};

type SortMode = "manual" | "due" | "priority" | "updated" | "title";

const SORT_OPTIONS: Option<SortMode>[] = [
  { value: "manual", label: "Manual order" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "updated", label: "Recently updated" },
  { value: "title", label: "Title" },
];

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function TaskListView({ tasks }: { tasks: TaskListItem[] }) {
  const [order, setOrder] = useState<string[]>(() => tasks.map((t) => t.id));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [label, setLabel] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("manual");

  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<TaskFormValues>(emptyTaskForm);
  const [cloning, setCloning] = useState<TaskListItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TaskListItem | null>(null);
  const { run, isPending } = useAction();

  // Keep the local order in step with the server after add/delete/reorder.
  const serverIds = tasks.map((t) => t.id).join(",");
  const [lastServerIds, setLastServerIds] = useState(serverIds);
  if (serverIds !== lastServerIds) {
    setLastServerIds(serverIds);
    setOrder(tasks.map((t) => t.id));
  }

  const labels = useMemo(
    () =>
      Array.from(
        new Set(tasks.map((t) => t.label).filter((l): l is string => !!l)),
      ).sort(),
    [tasks],
  );

  const filtersActive =
    search.trim() !== "" || status !== "all" || priority !== "all" || label !== "all";
  const canDrag = sort === "manual" && !filtersActive;

  const visible = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const ordered = order
      .map((id) => byId.get(id))
      .filter((t): t is TaskListItem => Boolean(t));

    const needle = search.trim().toLowerCase();
    const filtered = ordered.filter((task) => {
      if (status !== "all" && task.status !== status) return false;
      if (priority !== "all" && task.priority !== priority) return false;
      if (label !== "all" && task.label !== label) return false;
      if (
        needle &&
        !`${task.title} ${task.label ?? ""} ${task.description ?? ""}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });

    switch (sort) {
      case "due":
        return [...filtered].sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.getTime() - b.dueDate.getTime();
        });
      case "priority":
        return [...filtered].sort(
          (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
        );
      case "updated":
        return [...filtered].sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        );
      case "title":
        return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
      default:
        return filtered;
    }
  }, [tasks, order, search, status, priority, label, sort]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    const previous = order;
    const moved = arrayMove(order, from, to);
    setOrder(moved); // optimistic

    run(() => reorderTask(String(active.id), neighboursOf(moved, String(active.id))), {
      onError: () => setOrder(previous),
    });
  }

  function openNew() {
    setFormValues(emptyTaskForm());
    setFormOpen(true);
  }

  function openEdit(task: TaskListItem) {
    setFormValues(taskFormFrom(task));
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
        <div className="flex items-center gap-2">
          <ExportButton />
          <Button onClick={openNew}>
            <PlusIcon /> New task
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="h-8 w-full sm:w-64"
        />
        <div className="w-40">
          <OptionSelect
            size="sm"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all" as const, label: "All statuses" },
              ...optionsFrom(TASK_STATUSES, TASK_STATUS_LABELS),
            ]}
            ariaLabel="Filter by status"
          />
        </div>
        <div className="w-36">
          <OptionSelect
            size="sm"
            value={priority}
            onChange={setPriority}
            options={[
              { value: "all" as const, label: "All priorities" },
              ...optionsFrom(PRIORITIES, PRIORITY_LABELS),
            ]}
            ariaLabel="Filter by priority"
          />
        </div>
        {labels.length > 0 && (
          <div className="w-40">
            <OptionSelect
              size="sm"
              value={label}
              onChange={setLabel}
              options={[
                { value: "all", label: "All labels" },
                ...labels.map((l) => ({ value: l, label: l })),
              ]}
              ariaLabel="Filter by label"
            />
          </div>
        )}
        <div className="ml-auto w-44">
          <OptionSelect
            size="sm"
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
            ariaLabel="Sort tasks"
          />
        </div>
      </div>

      {!canDrag && sort === "manual" && (
        <p className="text-xs text-muted-foreground">
          Clear the filters to drag tasks into a new order.
        </p>
      )}
      {sort !== "manual" && (
        <p className="text-xs text-muted-foreground">
          Switch to manual order to drag tasks.
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {tasks.length === 0
              ? "No tasks yet. Create one to start tracking what you are owed."
              : "No tasks match these filters."}
          </p>
        </div>
      ) : (
        <VerticalSortable
          id="tasks"
          ids={visible.map((t) => t.id)}
          onDragEnd={handleDragEnd}
          disabled={!canDrag}
        >
          <ul className="space-y-2">
            {visible.map((task) => (
              <li key={task.id}>
                <SortableRow id={task.id} disabled={!canDrag}>
                  {(handle) => (
                    <div className="flex items-center gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20">
                      {handle}

                      <Link
                        href={`/tasks/${task.id}`}
                        className="min-w-0 flex-1 focus-visible:outline-none"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{task.title}</span>
                          <StatusBadge status={task.status} />
                          <PriorityBadge priority={task.priority} />
                          {task.label && (
                            <Badge variant="outline">{task.label}</Badge>
                          )}
                          {task.needsReminderCount > 0 && (
                            <ReminderBadge days={null} />
                          )}
                          {(task.isOverdue || task.overdueCount > 0) && (
                            <OverdueBadge />
                          )}
                        </div>

                        <div className="mt-2 flex items-center gap-3">
                          <div className="w-40">
                            <ProgressBar percent={task.progress.percent} />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {task.progress.done}/{task.progress.total} done
                          </span>
                          {task.dueDate && (
                            <span
                              className={cn(
                                "text-xs text-muted-foreground",
                                task.isOverdue && "text-destructive",
                              )}
                            >
                              Due {formatDate(task.dueDate)}
                            </span>
                          )}
                        </div>
                      </Link>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for ${task.title}`}
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => openEdit(task)}>
                            <PencilIcon /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCloning(task)}>
                            <CopyIcon /> Clone
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setPendingDelete(task)}
                          >
                            <Trash2Icon /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </SortableRow>
              </li>
            ))}
          </ul>
        </VerticalSortable>
      )}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={formValues}
        navigateOnCreate
      />

      {cloning && (
        <CloneTaskDialog
          open={cloning !== null}
          onOpenChange={(open) => !open && setCloning(null)}
          task={{
            id: cloning.id,
            title: cloning.title,
            subtaskCount: cloning.progress.total,
          }}
        />
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its subtasks and their history go with it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline">Cancel</Button>} />
            <AlertDialogAction
              render={<Button variant="destructive" disabled={isPending} />}
              onClick={(event) => {
                event.preventDefault();
                const id = pendingDelete?.id;
                if (!id) return;
                run(() => deleteTask(id), {
                  onSuccess: () => setPendingDelete(null),
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
