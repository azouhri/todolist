"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { moveSubtaskOnBoard } from "@/app/actions/ordering";
import {
  OverdueBadge,
  PriorityBadge,
  ReminderBadge,
  STATUS_ACCENT,
} from "@/components/common/badges";
import { SearchableSelect } from "@/components/common/searchable-select";
import { Badge } from "@/components/ui/badge";
import { StarIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import {
  SUBTASK_STATUSES,
  SUBTASK_STATUS_LABELS,
  type Priority,
  type SubtaskStatus,
} from "@/lib/domain/enums";
import { cn } from "@/lib/utils";

export type BoardCard = {
  id: string;
  title: string;
  status: SubtaskStatus;
  priority: Priority;
  ownerId: string;
  ownerName: string;
  taskId: string;
  taskTitle: string;
  label: string | null;
  daysWaiting: number | null;
  needsReminder: boolean;
  isOverdue: boolean;
  isDueToday: boolean;
  isFocused: boolean;
  isArchived: boolean;
};

const VISIBLE_STATUSES = SUBTASK_STATUSES.filter((s) => s !== "cancelled");

function SubtaskCard({
  card,
  dragging,
}: {
  card: BoardCard;
  dragging?: boolean;
}) {
  return (
    <Card
      className={cn(
        "gap-2 border-l-4 p-3 shadow-none transition-shadow",
        STATUS_ACCENT[card.status],
        dragging && "shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm leading-snug font-medium">{card.title}</span>
        <span className="flex shrink-0 items-center gap-1">
          {card.isFocused && (
            <StarIcon className="size-3.5 fill-amber-400 text-amber-500" />
          )}
          <PriorityBadge priority={card.priority} />
        </span>
      </div>

      <p className="truncate text-xs text-muted-foreground">
        {card.ownerName} · {card.taskTitle}
      </p>

      <div className="flex flex-wrap items-center gap-1">
        {card.label && <Badge variant="outline">{card.label}</Badge>}
        {card.needsReminder && <ReminderBadge days={card.daysWaiting} />}
        {(card.isOverdue || card.isDueToday) && (
          <OverdueBadge dueToday={card.isDueToday} />
        )}
      </div>
    </Card>
  );
}

function SortableCard({ card }: { card: BoardCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { status: card.status } });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <SubtaskCard card={card} />
    </li>
  );
}

function Column({
  status,
  cards,
}: {
  status: SubtaskStatus;
  cards: BoardCard[];
}) {
  // Lets an empty column still accept a drop.
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${status}`,
    data: { status },
  });

  return (
    // min-h-0 lets the card list scroll inside the column instead of pushing
    // the board taller than the viewport.
    <div className="flex min-h-0 w-72 shrink-0 flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between px-1">
        <h2 className="text-sm font-medium">{SUBTASK_STATUS_LABELS[status]}</h2>
        <Badge variant="secondary" className="tabular-nums">
          {cards.length}
        </Badge>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto rounded-lg border border-dashed bg-muted/30 p-2 transition-colors",
          isOver && "border-primary bg-accent/40",
        )}
      >
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {cards.map((card) => (
              <SortableCard key={card.id} card={card} />
            ))}
          </ul>
        </SortableContext>

        {cards.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Nothing here
          </p>
        )}
      </div>
    </div>
  );
}

export function BoardView({
  cards,
  contacts,
}: {
  cards: BoardCard[];
  contacts: { id: string; name: string }[];
}) {
  const [local, setLocal] = useState(cards);
  const [showCancelled, setShowCancelled] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [focusOnly, setFocusOnly] = useState(false);
  const [owner, setOwner] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const { run } = useAction();

  const serverKey = cards.map((c) => `${c.id}:${c.status}`).join(",");
  const [lastServerKey, setLastServerKey] = useState(serverKey);
  if (serverKey !== lastServerKey) {
    setLastServerKey(serverKey);
    setLocal(cards);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const statuses = useMemo(
    () =>
      showCancelled ? [...VISIBLE_STATUSES, "cancelled" as const] : VISIBLE_STATUSES,
    [showCancelled],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return local.filter((card) => {
      if (owner !== "all" && card.ownerId !== owner) return false;
      if (!showArchived && card.isArchived) return false;
      // Focus trims the future, never what is already in motion.
      if (focusOnly && card.status === "not_started" && !card.isFocused) return false;
      if (!needle) return true;
      // Search the card, its owner and its parent task together.
      return `${card.title} ${card.ownerName} ${card.taskTitle} ${card.label ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [local, owner, search, showArchived, focusOnly]);

  const byStatus = useMemo(() => {
    const map = new Map<SubtaskStatus, BoardCard[]>();
    for (const status of statuses) map.set(status, []);
    for (const card of filtered) map.get(card.status)?.push(card);
    return map;
  }, [filtered, statuses]);

  const activeCard = activeId ? local.find((c) => c.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const moved = local.find((c) => c.id === activeIdStr);
    if (!moved) return;

    // Dropped on a column body, or onto another card.
    const targetStatus = overIdStr.startsWith("column:")
      ? (overIdStr.slice("column:".length) as SubtaskStatus)
      : local.find((c) => c.id === overIdStr)?.status;
    if (!targetStatus) return;

    const previous = local;

    // Rebuild the destination column with the card in its new position.
    const destination = local.filter(
      (c) => c.status === targetStatus && c.id !== activeIdStr,
    );
    const overIndex = destination.findIndex((c) => c.id === overIdStr);
    const insertAt = overIndex === -1 ? destination.length : overIndex;
    destination.splice(insertAt, 0, { ...moved, status: targetStatus });

    if (
      moved.status === targetStatus &&
      previous.filter((c) => c.status === targetStatus).findIndex((c) => c.id === activeIdStr) ===
        insertAt
    ) {
      return; // nothing actually moved
    }

    setLocal(
      local.map((c) => (c.id === activeIdStr ? { ...c, status: targetStatus } : c)),
    );

    const prevId = insertAt > 0 ? destination[insertAt - 1]!.id : null;
    const nextId =
      insertAt < destination.length - 1 ? destination[insertAt + 1]!.id : null;

    run(() => moveSubtaskOnBoard(activeIdStr, targetStatus, { prevId, nextId }), {
      onError: () => setLocal(previous),
    });
  }

  return (
    // Fills the viewport: header row is fixed, the columns take the rest.
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Board</h1>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subtasks…"
            className="h-8 w-full sm:w-64"
          />
          <div className="w-44">
            <SearchableSelect
              size="sm"
              value={owner}
              onChange={setOwner}
              options={[
                { value: "all", label: "All owners" },
                ...contacts.map((c) => ({ value: c.id, label: c.name })),
              ]}
              ariaLabel="Filter by owner"
              searchPlaceholder="Search contacts…"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="focus-only"
              checked={focusOnly}
              onCheckedChange={(checked) => setFocusOnly(checked === true)}
            />
            <Label htmlFor="focus-only" className="text-sm font-normal">
              Focus only
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={(checked) => setShowArchived(checked === true)}
            />
            <Label htmlFor="show-archived" className="text-sm font-normal">
              Show archived
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-cancelled"
              checked={showCancelled}
              onCheckedChange={(checked) => setShowCancelled(checked === true)}
            />
            <Label htmlFor="show-cancelled" className="text-sm font-normal">
              Show cancelled
            </Label>
          </div>
        </div>
      </div>

      <DndContext
        // Stable id: dnd-kit's generated aria ids otherwise differ between
        // the server and client render and break hydration.
        id="board"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
          {statuses.map((status) => (
            <Column
              key={status}
              status={status}
              cards={byStatus.get(status) ?? []}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard && <SubtaskCard card={activeCard} dragging />}
        </DragOverlay>
      </DndContext>

      {local.length === 0 && (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No subtasks yet.{" "}
            <Link href="/tasks" className="underline">
              Create a task
            </Link>{" "}
            to get started.
          </p>
        </div>
      )}
    </div>
  );
}
