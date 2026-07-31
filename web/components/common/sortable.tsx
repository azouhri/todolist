"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shared drag-and-drop plumbing for the two vertical lists (subtasks in a task,
 * tasks in the list). The board builds its own multi-column context.
 */

export function useDragSensors() {
  return useSensors(
    // A small distance threshold keeps clicks on row buttons from starting drags.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

export function VerticalSortable({
  id,
  ids,
  onDragEnd,
  disabled,
  children,
}: {
  /**
   * Stable DndContext id. Without one, dnd-kit generates the ids behind
   * `aria-describedby` from a render counter, which differs between the server
   * and the client and trips a hydration mismatch.
   */
  id: string;
  ids: string[];
  onDragEnd: (event: DragEndEvent) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const sensors = useDragSensors();

  if (disabled) return <>{children}</>;

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/**
 * Neighbours of an item in its new position, for the reorder actions. `ids` must
 * already reflect the move.
 */
export function neighboursOf(ids: string[], movedId: string) {
  const index = ids.indexOf(movedId);
  return {
    prevId: index > 0 ? ids[index - 1] : null,
    nextId: index < ids.length - 1 ? ids[index + 1] : null,
  };
}

export function SortableRow({
  id,
  disabled,
  className,
  children,
}: {
  id: string;
  disabled?: boolean;
  className?: string;
  /** Receives the handle to place wherever the row wants it. */
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const handle = disabled ? (
    <span className="inline-flex size-6 items-center justify-center text-muted-foreground/30">
      <GripVerticalIcon className="size-4" />
    </span>
  ) : (
    <button
      type="button"
      className="inline-flex size-6 cursor-grab items-center justify-center rounded text-muted-foreground/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
      aria-label="Reorder"
      {...attributes}
      {...listeners}
    >
      <GripVerticalIcon className="size-4" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-80 shadow-lg", className)}
    >
      {children(handle)}
    </div>
  );
}
