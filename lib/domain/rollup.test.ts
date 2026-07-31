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

  it("returns to the roll-up once the override is cleared", () => {
    expect(computeTaskStatus([at("blocked")], null)).toBe("blocked");
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
});
