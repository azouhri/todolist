"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ArrowLeftIcon, CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { reorderSubtask } from "@/app/actions/ordering";
import { createSubtask } from "@/app/actions/subtasks";
import { deleteTask, setTaskManualStatus } from "@/app/actions/tasks";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { SearchableSelect } from "@/components/common/searchable-select";
import { OptionSelect } from "@/components/common/option-select";
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
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/date";
import type { Priority, TaskStatus } from "@/lib/domain/enums";

import { CloneTaskDialog } from "./clone-task-dialog";
import { HistorySheet, type HistoryItem } from "./history-sheet";
import { SubtaskRow, type SubtaskRowData } from "./subtask-row";
import { TaskFormDialog, taskFormFrom } from "./task-form-dialog";

export type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  label: string | null;
  priority: Priority;
  status: TaskStatus;
  manualStatus: TaskStatus | null;
  dueDate: Date | null;
  completedAt: Date | null;
  progress: { done: number; total: number; percent: number };
};

export type DetailSubtask = SubtaskRowData & {
  history: HistoryItem[];
  reminderCount: number;
};

const MANUAL_STATUS_OPTIONS = [
  { value: "auto", label: "Automatic (from subtasks)" },
  { value: "lost", label: "Lost" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function TaskDetailView({
  task,
  subtasks,
  contacts,
  defaultOwnerId,
  focusSubtaskId,
}: {
  task: TaskDetail;
  subtasks: DetailSubtask[];
  contacts: { id: string; name: string }[];
  defaultOwnerId: string | null;
  /** From ?subtask= — lets the reminder bell deep-link to a row. */
  focusSubtaskId?: string;
}) {
  const [order, setOrder] = useState<string[]>(() => subtasks.map((s) => s.id));
  const [newTitle, setNewTitle] = useState("");
  const [newOwnerId, setNewOwnerId] = useState<string | null>(defaultOwnerId);
  const [editOpen, setEditOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<string | null>(
    focusSubtaskId ?? null,
  );
  const { run, isPending } = useAction();
  const router = useRouter();

  const serverIds = subtasks.map((s) => s.id).join(",");
  const [lastServerIds, setLastServerIds] = useState(serverIds);
  if (serverIds !== lastServerIds) {
    setLastServerIds(serverIds);
    setOrder(subtasks.map((s) => s.id));
  }

  const ordered = useMemo(() => {
    const byId = new Map(subtasks.map((s) => [s.id, s]));
    return order
      .map((id) => byId.get(id))
      .filter((s): s is DetailSubtask => Boolean(s));
  }, [subtasks, order]);

  const historySubject = historyFor
    ? (subtasks.find((s) => s.id === historyFor) ?? null)
    : null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    const previous = order;
    const moved = arrayMove(order, from, to);
    setOrder(moved);

    run(
      () => reorderSubtask(String(active.id), neighboursOf(moved, String(active.id))),
      { onError: () => setOrder(previous) },
    );
  }

  function handleQuickAdd(event: React.FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    if (!newOwnerId) return;

    run(
      () => createSubtask({ taskId: task.id, title, ownerId: newOwnerId }),
      { onSuccess: () => setNewTitle("") },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        {/* nativeButton={false}: this renders an <a>, not a <button>. */}
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2"
          nativeButton={false}
          render={<Link href="/tasks" />}
        >
          <ArrowLeftIcon /> All tasks
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{task.title}</h1>
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              {task.label && <Badge variant="outline">{task.label}</Badge>}
            </div>
            {task.description && (
              <p className="mt-2 max-w-2xl text-sm whitespace-pre-wrap text-muted-foreground">
                {task.description}
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              {task.progress.done}/{task.progress.total} subtasks done
              {task.dueDate && ` · due ${formatDate(task.dueDate)}`}
              {task.completedAt && ` · completed ${formatDate(task.completedAt)}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-56">
              <OptionSelect
                size="sm"
                value={task.manualStatus ?? "auto"}
                onChange={(value) =>
                  run(() =>
                    setTaskManualStatus(task.id, value === "auto" ? null : value),
                  )
                }
                options={[...MANUAL_STATUS_OPTIONS]}
                ariaLabel="Task status override"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <PencilIcon /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCloneOpen(true)}>
              <CopyIcon /> Clone
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete task"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon />
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleQuickAdd} className="flex flex-wrap items-center gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a subtask — what do you need, and from whom?"
          className="h-9 min-w-0 flex-1"
        />
        <div className="w-44">
          <SearchableSelect
            value={newOwnerId}
            onChange={setNewOwnerId}
            options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Owner"
            ariaLabel="New subtask owner"
            searchPlaceholder="Search contacts…"
          />
        </div>
        <Button type="submit" disabled={isPending || !newTitle.trim() || !newOwnerId}>
          <PlusIcon /> Add
        </Button>
      </form>

      {contacts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add a contact first — every subtask needs an owner.{" "}
          <Link href="/contacts" className="underline">
            Go to contacts
          </Link>
        </p>
      )}

      {ordered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No subtasks yet. Add the first thing someone owes you.
          </p>
        </div>
      ) : (
        <VerticalSortable id="subtasks" ids={order} onDragEnd={handleDragEnd}>
          <ul className="space-y-2">
            {ordered.map((subtask) => (
              <li key={subtask.id}>
                <SortableRow id={subtask.id}>
                  {(handle) => (
                    <SubtaskRow
                      subtask={subtask}
                      contacts={contacts}
                      handle={handle}
                      highlighted={subtask.id === focusSubtaskId}
                      onOpenHistory={() => setHistoryFor(subtask.id)}
                    />
                  )}
                </SortableRow>
              </li>
            ))}
          </ul>
        </VerticalSortable>
      )}

      <TaskFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={taskFormFrom(task)}
      />

      <CloneTaskDialog
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        task={{
          id: task.id,
          title: task.title,
          subtaskCount: subtasks.length,
        }}
      />

      <HistorySheet
        open={historySubject !== null}
        onOpenChange={(open) => !open && setHistoryFor(null)}
        subject={
          historySubject && {
            id: historySubject.id,
            title: historySubject.title,
            ownerName: historySubject.ownerName,
            daysWaiting: historySubject.clocks.daysWaiting,
            daysSinceLastContact: historySubject.clocks.daysSinceLastContact,
            effectiveAlertAfterDays: historySubject.clocks.effectiveAlertAfterDays,
            reminderCount: historySubject.reminderCount,
          }
        }
        history={historySubject?.history ?? []}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{task.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its {subtasks.length} subtask{subtasks.length === 1 ? "" : "s"} and
              all their history go with it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline">Cancel</Button>} />
            <AlertDialogAction
              render={<Button variant="destructive" disabled={isPending} />}
              onClick={(event) => {
                event.preventDefault();
                run(() => deleteTask(task.id), {
                  onSuccess: () => router.push("/tasks"),
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
