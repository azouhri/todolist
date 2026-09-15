import { describe, expect, it } from "vitest";

import type { SubtaskStatus } from "./enums";
import {
  computeProgress,
  computeTaskCompletedAt,
  computeTaskStatus,
  isTaskComplete,
  type RollupSubtask,
} from "./rollup";

const at = (status: SubtaskStatus, completedAt?: Date): RollupSubtask => ({
  status,
  completedAt: completedAt ?? null,
});

describe("computeTaskStatus", () => {
  it("returns not_started when there are no subtasks", () => {
    expect(computeTaskStatus([])).toBe("not_started");
  });

  it("lets blocked beat waiting", () => {
    expect(computeTaskStatus([at("waiting"), at("blocked")])).toBe("blocked");
  });

  it("lets waiting beat in_progress", () => {
    expect(computeTaskStatus([at("in_progress"), at("waiting")])).toBe("waiting");
  });

  it("lets in_progress beat done", () => {
    expect(computeTaskStatus([at("done"), at("in_progress")])).toBe("in_progress");
  });

  it("is done only when every non-cancelled subtask is done", () => {
    expect(computeTaskStatus([at("done"), at("done")])).toBe("done");
  });

  it("does not report done while work remains untouched", () => {
    expect(computeTaskStatus([at("done"), at("not_started")])).toBe("in_progress");
  });

  it("ignores cancelled subtasks", () => {
    expect(computeTaskStatus([at("done"), at("cancelled")])).toBe("done");
    expect(computeTaskStatus([at("cancelled"), at("blocked")])).toBe("blocked");
  });

  it("returns not_started when every subtask is cancelled", () => {
    expect(computeTaskStatus([at("cancelled"), at("cancelled")])).toBe("not_started");
  });

  it("lets a manual lost/cancelled override the roll-up", () => {
    expect(computeTaskStatus([at("blocked")], "lost")).toBe("lost");
    expect(computeTaskStatus([at("done")], "cancelled")).toBe("cancelled");
  });

  it("lets a manual on_hold park a task whose subtasks are still live", () => {
    expect(computeTaskStatus([at("in_progress")], "on_hold")).toBe("on_hold");
    expect(computeTaskStatus([at("blocked")], "on_hold")).toBe("on_hold");
  });

  it("returns to the roll-up once the override is cleared", () => {
    expect(computeTaskStatus([at("blocked")], null)).toBe("blocked");
  });

  it("ignores a status that cannot be set by hand", () => {
    // Only the manual set overrides; a stray value falls through to the roll-up.
    expect(computeTaskStatus([at("blocked")], "in_progress")).toBe("blocked");
  });
});

describe("computeTaskStatus — on hold", () => {
  it("never masks work that is still moving", () => {
    expect(computeTaskStatus([at("in_progress"), at("on_hold")])).toBe(
      "in_progress",
    );
    expect(computeTaskStatus([at("waiting"), at("on_hold")])).toBe("waiting");
    expect(computeTaskStatus([at("blocked"), at("on_hold")])).toBe("blocked");
  });

  it("surfaces once nothing is moving", () => {
    expect(computeTaskStatus([at("on_hold")])).toBe("on_hold");
    expect(computeTaskStatus([at("on_hold"), at("not_started")])).toBe("on_hold");
  });

  it("beats done while parked work remains", () => {
    expect(computeTaskStatus([at("on_hold"), at("done")])).toBe("on_hold");
  });

  it("does not stop a fully finished task reading as done", () => {
    expect(computeTaskStatus([at("done"), at("done")])).toBe("done");
  });

  it("is ignored once the parked subtask is cancelled outright", () => {
    expect(computeTaskStatus([at("cancelled"), at("done")])).toBe("done");
  });
});

describe("isTaskComplete", () => {
  it("is false for an empty task", () => {
    expect(isTaskComplete([])).toBe(false);
  });

  it("is false when a cancelled subtask is the only non-done one", () => {
    expect(isTaskComplete([at("done"), at("cancelled")])).toBe(true);
  });

  it("is false while anything is open", () => {
    expect(isTaskComplete([at("done"), at("waiting")])).toBe(false);
  });

  // Parked work is unfinished work: completedAt must stay null so the task is
  // never reported as delivered while something is waiting to be resumed.
  it("is false while a subtask is parked", () => {
    expect(isTaskComplete([at("done"), at("on_hold")])).toBe(false);
    expect(computeTaskCompletedAt([at("done", new Date()), at("on_hold")])).toBeNull();
  });
});

describe("computeTaskCompletedAt", () => {
  it("is null while work remains", () => {
    expect(computeTaskCompletedAt([at("done"), at("waiting")])).toBeNull();
  });

  it("is the newest subtask completion", () => {
    const early = new Date("2026-01-01");
    const late = new Date("2026-03-01");
    expect(computeTaskCompletedAt([at("done", early), at("done", late)])).toEqual(
      late,
    );
  });
});

describe("computeProgress", () => {
  it("counts done over non-cancelled", () => {
    expect(computeProgress([at("done"), at("waiting"), at("cancelled")])).toEqual({
      done: 1,
      total: 2,
      percent: 50,
    });
  });

  it("is zero for an empty task", () => {
    expect(computeProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });

  // Unlike cancelled, a parked subtask still counts against the total: it is
  // work that may yet come back, so hiding it would overstate progress.
  it("still counts parked subtasks as outstanding", () => {
    expect(computeProgress([at("done"), at("on_hold")])).toEqual({
      done: 1,
      total: 2,
      percent: 50,
    });
  });
});
