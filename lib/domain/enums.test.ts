import { describe, expect, it } from "vitest";

import {
  SUBTASK_STATUSES,
  TASK_STATUSES,
  isDormantSubtaskStatus,
  isFinishedTaskStatus,
  isManualTaskStatus,
  showsFinishedTasks,
  type TaskStatus,
} from "./enums";

describe("isFinishedTaskStatus", () => {
  it("treats the three terminal outcomes as finished", () => {
    expect(isFinishedTaskStatus("done")).toBe(true);
    expect(isFinishedTaskStatus("lost")).toBe(true);
    expect(isFinishedTaskStatus("cancelled")).toBe(true);
  });

  it("treats live work as unfinished", () => {
    expect(isFinishedTaskStatus("not_started")).toBe(false);
    expect(isFinishedTaskStatus("in_progress")).toBe(false);
    expect(isFinishedTaskStatus("waiting")).toBe(false);
    expect(isFinishedTaskStatus("blocked")).toBe(false);
  });

  // The distinction the whole feature rests on: a hold is a pause, not an
  // outcome, so it must not be swept away with done/lost/cancelled.
  it("does not treat a hold as an outcome", () => {
    expect(isFinishedTaskStatus("on_hold")).toBe(false);
    expect(showsFinishedTasks(false, "on_hold")).toBe(false);
  });

  it("classifies every task status one way or the other", () => {
    for (const status of TASK_STATUSES) {
      expect(typeof isFinishedTaskStatus(status)).toBe("boolean");
    }
  });
});

describe("showsFinishedTasks", () => {
  it("hides finished work by default", () => {
    expect(showsFinishedTasks(false, "all")).toBe(false);
  });

  it("shows it once the toggle is on", () => {
    expect(showsFinishedTasks(true, "all")).toBe(true);
  });

  it("keeps hiding it while filtering to a live status", () => {
    expect(showsFinishedTasks(false, "waiting")).toBe(false);
    expect(showsFinishedTasks(false, "blocked")).toBe(false);
    expect(showsFinishedTasks(false, "not_started")).toBe(false);
  });

  // The subtle one: filtering to "Done" must not return an empty list.
  it("lets an explicit terminal filter override the default", () => {
    expect(showsFinishedTasks(false, "done")).toBe(true);
    expect(showsFinishedTasks(false, "lost")).toBe(true);
    expect(showsFinishedTasks(false, "cancelled")).toBe(true);
  });

  it("never contradicts the toggle when it is on", () => {
    for (const status of [...TASK_STATUSES, "all"] as (TaskStatus | "all")[]) {
      expect(showsFinishedTasks(true, status)).toBe(true);
    }
  });

  it("only reveals finished work for terminal filters", () => {
    for (const status of TASK_STATUSES) {
      expect(showsFinishedTasks(false, status)).toBe(isFinishedTaskStatus(status));
    }
  });
});

describe("isDormantSubtaskStatus", () => {
  it("covers the parked status alongside the closed ones", () => {
    expect(isDormantSubtaskStatus("on_hold")).toBe(true);
    expect(isDormantSubtaskStatus("done")).toBe(true);
    expect(isDormantSubtaskStatus("cancelled")).toBe(true);
  });

  it("leaves anything that still wants attention alone", () => {
    expect(isDormantSubtaskStatus("not_started")).toBe(false);
    expect(isDormantSubtaskStatus("in_progress")).toBe(false);
    expect(isDormantSubtaskStatus("waiting")).toBe(false);
    // Blocked is stuck, not parked — someone still has to unstick it.
    expect(isDormantSubtaskStatus("blocked")).toBe(false);
  });

  it("classifies every subtask status one way or the other", () => {
    for (const status of SUBTASK_STATUSES) {
      expect(typeof isDormantSubtaskStatus(status)).toBe("boolean");
    }
  });
});

describe("isManualTaskStatus", () => {
  it("accepts exactly the hand-set statuses", () => {
    expect(isManualTaskStatus("on_hold")).toBe(true);
    expect(isManualTaskStatus("lost")).toBe(true);
    expect(isManualTaskStatus("cancelled")).toBe(true);
  });

  it("rejects the ones that are derived from subtasks", () => {
    expect(isManualTaskStatus("not_started")).toBe(false);
    expect(isManualTaskStatus("in_progress")).toBe(false);
    expect(isManualTaskStatus("waiting")).toBe(false);
    expect(isManualTaskStatus("blocked")).toBe(false);
    expect(isManualTaskStatus("done")).toBe(false);
  });
});
