"use client";

import { useState } from "react";
import { Trash2Icon } from "lucide-react";

import { addHistoryEvent, deleteHistoryEvent } from "@/app/actions/subtasks";
import { OptionSelect, optionsFrom } from "@/components/common/option-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { formatDateTime, toDateInputValue } from "@/lib/date";
import {
  HISTORY_EVENT_LABELS,
  HISTORY_EVENT_TYPES,
  REMINDER_EVENT_TYPES,
  type HistoryEventType,
} from "@/lib/domain/enums";

export type HistoryItem = {
  id: string;
  type: HistoryEventType;
  note: string | null;
  occurredAt: Date;
};

export type HistorySubject = {
  id: string;
  title: string;
  ownerName: string;
  daysWaiting: number | null;
  daysSinceLastContact: number | null;
  effectiveAlertAfterDays: number;
  reminderCount: number;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

export function HistorySheet({
  open,
  onOpenChange,
  subject,
  history,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: HistorySubject | null;
  history: HistoryItem[];
}) {
  const [type, setType] = useState<HistoryEventType>("reminder_sent");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(toDateInputValue(new Date()));
  const { run, isPending } = useAction();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!subject) return;
    run(
      () =>
        addHistoryEvent(subject.id, {
          type,
          note,
          occurredAt: occurredAt || null,
        }),
      {
        onSuccess: () => {
          setNote("");
          setOccurredAt(toDateInputValue(new Date()));
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="pr-6">{subject?.title ?? "History"}</SheetTitle>
          <SheetDescription>
            {subject ? `Owed by ${subject.ownerName}` : null}
          </SheetDescription>
        </SheetHeader>

        {subject && (
          <div className="grid grid-cols-2 gap-2 px-4">
            <Stat
              label="Waiting"
              value={
                subject.daysWaiting === null ? "—" : `${subject.daysWaiting} days`
              }
            />
            <Stat
              label="Last contact"
              value={
                subject.daysSinceLastContact === null
                  ? "—"
                  : `${subject.daysSinceLastContact} days ago`
              }
            />
            <Stat
              label="Chase after"
              value={`${subject.effectiveAlertAfterDays} days`}
            />
            <Stat label="Reminders sent" value={String(subject.reminderCount)} />
          </div>
        )}

        <Separator />

        <form onSubmit={handleSubmit} className="grid gap-3 px-4">
          <p className="text-sm font-medium">Log an event</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="event-type" className="text-xs">
                Type
              </Label>
              <OptionSelect
                size="sm"
                value={type}
                onChange={setType}
                options={optionsFrom(HISTORY_EVENT_TYPES, HISTORY_EVENT_LABELS)}
                ariaLabel="Event type"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="event-date" className="text-xs">
                Date
              </Label>
              <Input
                id="event-date"
                type="date"
                className="h-7"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="What happened?"
          />
          <Button type="submit" size="sm" disabled={isPending || !subject}>
            Log event
          </Button>
          {REMINDER_EVENT_TYPES.includes(type) && (
            <p className="text-xs text-muted-foreground">
              Resets the reminder cooldown. The waiting clock keeps running.
            </p>
          )}
        </form>

        <Separator />

        <ScrollArea className="flex-1">
          <div className="px-4 pb-4">
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing logged yet.
              </p>
            ) : (
              <ol className="space-y-3">
                {history.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <div className="mt-1.5 size-2 shrink-0 rounded-full bg-border" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {HISTORY_EVENT_LABELS[item.type]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(item.occurredAt)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto size-6"
                          aria-label="Delete event"
                          onClick={() => run(() => deleteHistoryEvent(item.id))}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                      {item.note && (
                        <p className="mt-1 text-sm whitespace-pre-wrap">
                          {item.note}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
