import { subDays } from "date-fns";
import { describe, expect, it } from "vitest";

import { computeClocks, type ClockSubtask } from "./clocks";

const TODAY = new Date("2026-07-30T12:00:00Z");
const DEFAULT_ALERT = 3;

function waiting(overrides: Partial<ClockSubtask> = {}): ClockSubtask {
  return {
    status: "waiting",
    requestedDate: subDays(TODAY, 5),
    history: [],
    ...overrides,
  };
}

describe("daysWaiting", () => {
  it("counts from requestedDate while waiting", () => {
    expect(computeClocks(waiting(), DEFAULT_ALERT, TODAY).daysWaiting).toBe(5);
  });

  it("is null when the subtask is not waiting", () => {
    const clocks = computeClocks(
      waiting({ status: "in_progress" }),
      DEFAULT_ALERT,
      TODAY,
    );
    expect(clocks.daysWaiting).toBeNull();
  });

  it("is null when nothing was ever requested", () => {
    const clocks = computeClocks(
      waiting({ requestedDate: null }),
      DEFAULT_ALERT,
      TODAY,
    );
    expect(clocks.daysWaiting).toBeNull();
  });
});

describe("needsReminder", () => {
  it("is false before the cooldown elapses", () => {
    const clocks = computeClocks(
      waiting({ requestedDate: subDays(TODAY, 2) }),
      DEFAULT_ALERT,
      TODAY,
    );
    expect(clocks.daysSinceLastContact).toBe(2);
    expect(clocks.needsReminder).toBe(false);
  });

  it("is true once the cooldown is reached", () => {
    const clocks = computeClocks(
      waiting({ requestedDate: subDays(TODAY, 3) }),
      DEFAULT_ALERT,
      TODAY,
    );
    expect(clocks.needsReminder).toBe(true);
  });

  it("is false for subtasks that are not waiting", () => {
    const clocks = computeClocks(
      waiting({ status: "blocked", requestedDate: subDays(TODAY, 30) }),
      DEFAULT_ALERT,
      TODAY,
    );
    expect(clocks.needsReminder).toBe(false);
  });

  it("honours a per-subtask override of the default", () => {
    const clocks = computeClocks(
      waiting({ requestedDate: subDays(TODAY, 5), alertAfterDays: 10 }),
      DEFAULT_ALERT,
      TODAY,
    );
    expect(clocks.effectiveAlertAfterDays).toBe(10);
    expect(clocks.needsReminder).toBe(false);
  });
});

describe("the two clocks are independent", () => {
  it("reminder_sent resets the cooldown but not daysWaiting", () => {
    const clocks = computeClocks(
      waiting({
        requestedDate: subDays(TODAY, 12),
        history: [{ type: "reminder_sent", occurredAt: subDays(TODAY, 1) }],
      }),
      DEFAULT_ALERT,
      TODAY,
    );

    expect(clocks.daysWaiting).toBe(12); // still owed for 12 days
    expect(clocks.daysSinceLastContact).toBe(1); // but chased yesterday
    expect(clocks.needsReminder).toBe(false);
  });

  it("asks to chase again once the cooldown lapses after a reminder", () => {
    const clocks = computeClocks(
      waiting({
        requestedDate: subDays(TODAY, 12),
        history: [{ type: "reminder_sent", occurredAt: subDays(TODAY, 6) }],
      }),
      DEFAULT_ALERT,
      TODAY,
    );

    expect(clocks.daysWaiting).toBe(12);
    expect(clocks.needsReminder).toBe(true);
  });

  it("measures the cooldown from the newest event, whatever its type", () => {
    const clocks = computeClocks(
      waiting({
        requestedDate: subDays(TODAY, 20),
        history: [
          { type: "reminder_sent", occurredAt: subDays(TODAY, 9) },
          { type: "note", occurredAt: subDays(TODAY, 1) },
        ],
      }),
      DEFAULT_ALERT,
      TODAY,
    );

    expect(clocks.daysSinceLastContact).toBe(1);
    expect(clocks.needsReminder).toBe(false);
  });
});

describe("reminderCount", () => {
  it("counts only the chasing events", () => {
    const clocks = computeClocks(
      waiting({
        history: [
          { type: "reminder_sent", occurredAt: subDays(TODAY, 8) },
          { type: "escalated", occurredAt: subDays(TODAY, 4) },
          { type: "note", occurredAt: subDays(TODAY, 2) },
          { type: "reply_received", occurredAt: subDays(TODAY, 1) },
        ],
      }),
      DEFAULT_ALERT,
      TODAY,
    );

    expect(clocks.reminderCount).toBe(2);
  });
});

describe("due dates", () => {
  it("flags an open subtask past its due date", () => {
    const clocks = computeClocks(
      waiting({ dueDate: subDays(TODAY, 1) }),
      DEFAULT_ALERT,
      TODAY,
    );
    expect(clocks.isOverdue).toBe(true);
    expect(clocks.isDueToday).toBe(false);
  });

  it("flags due today separately", () => {
    const clocks = computeClocks(waiting({ dueDate: TODAY }), DEFAULT_ALERT, TODAY);
    expect(clocks.isDueToday).toBe(true);
    expect(clocks.isOverdue).toBe(false);
  });

  it("does not flag closed subtasks", () => {
    const clocks = computeClocks(
      waiting({ status: "done", dueDate: subDays(TODAY, 10) }),
      DEFAULT_ALERT,
      TODAY,
    );
    expect(clocks.isOverdue).toBe(false);
  });
});
