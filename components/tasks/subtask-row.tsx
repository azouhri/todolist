"use client";

import { useState } from "react";
import {
  ArchiveIcon,
  ClockIcon,
  HistoryIcon,
  MoreHorizontalIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";

import {
  changeSubtaskStatus,
  deleteSubtask,
  setSubtaskArchived,
  setSubtaskFocus,
  updateSubtask,
} from "@/app/actions/subtasks";
import {
  OverdueBadge,
  PriorityBadge,
  ReminderBadge,
  STATUS_ACCENT,
} from "@/components/common/badges";
import { SearchableSelect } from "@/components/common/searchable-select";
import { OptionSelect, optionsFrom } from "@/components/common/option-select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAction } from "@/hooks/use-action";
import { fromDateInputValue, toDateInputValue } from "@/lib/date";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  SUBTASK_STATUSES,
  SUBTASK_STATUS_LABELS,
  type Priority,
  type SubtaskStatus,
} from "@/lib/domain/enums";
import { cn } from "@/lib/utils";

export type SubtaskRowData = {
  id: string;
  title: string;
  status: SubtaskStatus;
  priority: Priority;
  ownerId: string;
  ownerName: string;
  requestedDate: Date | null;
  dueDate: Date | null;
  alertAfterDays: number | null;
  isFocused: boolean;
  isArchived: boolean;
  clocks: {
    daysWaiting: number | null;
    daysSinceLastContact: number | null;
    effectiveAlertAfterDays: number;
    needsReminder: boolean;
    isOverdue: boolean;
    isDueToday: boolean;
  };
};

export function SubtaskRow({
  subtask,
  contacts,
  handle,
  onOpenHistory,
  highlighted,
}: {
  subtask: SubtaskRowData;
  contacts: { id: string; name: string }[];
  handle: React.ReactNode;
  onOpenHistory: () => void;
  highlighted?: boolean;
}) {
  const [title, setTitle] = useState(subtask.title);
  const { run, isPending } = useAction();

  const isClosed = subtask.status === "done" || subtask.status === "cancelled";

  function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === subtask.title) {
      setTitle(subtask.title);
      return;
    }
    run(() => updateSubtask(subtask.id, { title: trimmed }));
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-l-4 bg-card p-3 transition-colors",
        STATUS_ACCENT[subtask.status],
        highlighted && "ring-2 ring-ring",
        isClosed && "opacity-60",
        subtask.isArchived && "opacity-45",
      )}
    >
      <div className="flex items-center gap-2">
        {handle}

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setTitle(subtask.title);
              e.currentTarget.blur();
            }
          }}
          aria-label="Subtask title"
          className={cn(
            "h-8 flex-1 border-transparent bg-transparent px-1.5 font-medium shadow-none hover:border-input focus-visible:border-ring",
            isClosed && "line-through",
          )}
        />

        {subtask.isFocused && (
          <StarIcon className="size-4 shrink-0 fill-amber-400 text-amber-500" />
        )}
        {subtask.isArchived && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            Archived
          </span>
        )}
        {subtask.clocks.needsReminder && (
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <ReminderBadge days={subtask.clocks.daysWaiting} />
            </TooltipTrigger>
            <TooltipContent>
              No contact for {subtask.clocks.daysSinceLastContact} days (chase
              after {subtask.clocks.effectiveAlertAfterDays})
            </TooltipContent>
          </Tooltip>
        )}
        {(subtask.clocks.isOverdue || subtask.clocks.isDueToday) && (
          <OverdueBadge dueToday={subtask.clocks.isDueToday} />
        )}
        <PriorityBadge priority={subtask.priority} />

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${subtask.title}`}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <MoreHorizontalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onOpenHistory}>
              <HistoryIcon /> History
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => run(() => deleteSubtask(subtask.id))}
            >
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-8">
        <div className="w-36">
          <OptionSelect
            size="sm"
            value={subtask.status}
            onChange={(status) => run(() => changeSubtaskStatus(subtask.id, status))}
            options={optionsFrom(SUBTASK_STATUSES, SUBTASK_STATUS_LABELS)}
            disabled={isPending}
            ariaLabel="Status"
          />
        </div>

        <div className="w-40">
          <SearchableSelect
            size="sm"
            value={subtask.ownerId}
            onChange={(ownerId) => run(() => updateSubtask(subtask.id, { ownerId }))}
            options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            disabled={isPending}
            ariaLabel="Owner"
            searchPlaceholder="Search contacts…"
          />
        </div>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Requested
          <Input
            type="date"
            className="h-7 w-36"
            value={toDateInputValue(subtask.requestedDate)}
            onChange={(e) =>
              run(() =>
                updateSubtask(subtask.id, {
                  requestedDate: fromDateInputValue(e.target.value),
                }),
              )
            }
          />
        </label>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Due
          <Input
            type="date"
            className="h-7 w-36"
            value={toDateInputValue(subtask.dueDate)}
            onChange={(e) =>
              run(() =>
                updateSubtask(subtask.id, {
                  dueDate: fromDateInputValue(e.target.value),
                }),
              )
            }
          />
        </label>

        <div className="w-28">
          <OptionSelect
            size="sm"
            value={subtask.priority}
            onChange={(priority) => run(() => updateSubtask(subtask.id, { priority }))}
            options={optionsFrom(PRIORITIES, PRIORITY_LABELS)}
            disabled={isPending}
            ariaLabel="Priority"
          />
        </div>

        <Tooltip>
          <TooltipTrigger
            render={
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ClockIcon className="size-3.5" />
                <Input
                  type="number"
                  min={0}
                  max={365}
                  className="h-7 w-16 tabular-nums"
                  placeholder={String(subtask.clocks.effectiveAlertAfterDays)}
                  value={subtask.alertAfterDays ?? ""}
                  onChange={(e) =>
                    run(() =>
                      updateSubtask(subtask.id, {
                        alertAfterDays:
                          e.target.value === "" ? null : Number(e.target.value),
                      }),
                    )
                  }
                />
              </label>
            }
          />
          <TooltipContent>
            Chase after this many quiet days. Blank uses the app default.
          </TooltipContent>
        </Tooltip>

        {subtask.status === "waiting" && subtask.clocks.daysWaiting !== null && (
          <span className="text-xs text-muted-foreground tabular-nums">
            Waiting {subtask.clocks.daysWaiting}d
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {subtask.status === "not_started" && (
            <label
              className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
              title="Bring this into the current working horizon"
            >
              <Switch
                checked={subtask.isFocused}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  run(() => setSubtaskFocus(subtask.id, checked === true))
                }
              />
              <StarIcon
                className={cn(
                  "size-3.5",
                  subtask.isFocused && "fill-amber-400 text-amber-500",
                )}
              />
              Focus
            </label>
          )}

          {isClosed && (
            <label
              className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
              title="Put this away without changing its status"
            >
              <Switch
                checked={subtask.isArchived}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  run(() => setSubtaskArchived(subtask.id, checked === true))
                }
              />
              <ArchiveIcon className="size-3.5" />
              Archive
            </label>
          )}

          <Button variant="ghost" size="sm" className="h-7" onClick={onOpenHistory}>
            <HistoryIcon /> History
          </Button>
        </div>
      </div>
    </div>
  );
}
