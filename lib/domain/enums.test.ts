import { describe, expect, it } from "vitest";

import {
  TASK_STATUSES,
  isFinishedTaskStatus,
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
