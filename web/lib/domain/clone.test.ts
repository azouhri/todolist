import { describe, expect, it } from "vitest";

import {
  cloneSubtasks,
  contactDeleteBlockReason,
  type CloneOptions,
  type CloneableSubtask,
} from "./clone";

const REQUESTED = new Date("2026-07-18");
const DUE = new Date("2026-08-09");
const COMPLETED = new Date("2026-07-25");

function source(overrides: Partial<CloneableSubtask> = {}): CloneableSubtask {
  return {
    title: "Signed vendor DPA",
    description: "Chase legal",
    ownerId: "contact-priya",
    status: "waiting",
    priority: "high",
    requestedDate: REQUESTED,
    dueDate: DUE,
    completedAt: null,
    alertAfterDays: 5,
    sortOrder: 1000,
    boardOrder: 2000,
    ...overrides,
  };
}

const options = (overrides: Partial<CloneOptions> = {}): CloneOptions => ({
  includeSubtasks: true,
  keepOwners: true,
  keepDueDates: false,
  resetStatuses: true,
  ...overrides,
});

describe("cloneSubtasks", () => {
  it("returns nothing when subtasks are excluded", () => {
    expect(cloneSubtasks([source()], options({ includeSubtasks: false }), "me")).toEqual(
      [],
    );
  });

  it("never carries history across (the clone has no timeline)", () => {
    const [clone] = cloneSubtasks([source()], options(), "me");
    expect(clone).not.toHaveProperty("history");
  });

  it("resets statuses and the waiting clock by default", () => {
    const [clone] = cloneSubtasks([source()], options(), "me");
    expect(clone!.status).toBe("not_started");
    expect(clone!.requestedDate).toBeNull();
    expect(clone!.completedAt).toBeNull();
  });

  it("keeps statuses and their clocks when asked", () => {
    const [clone] = cloneSubtasks(
      [source({ status: "done", completedAt: COMPLETED })],
      options({ resetStatuses: false }),
      "me",
    );
    expect(clone!.status).toBe("done");
    expect(clone!.completedAt).toEqual(COMPLETED);
  });

  it("keeps owners by default", () => {
    const [clone] = cloneSubtasks([source()], options(), "contact-me");
    expect(clone!.ownerId).toBe("contact-priya");
  });

  it("reassigns to the fallback owner when owners are dropped", () => {
    const [clone] = cloneSubtasks(
      [source()],
      options({ keepOwners: false }),
      "contact-me",
    );
    expect(clone!.ownerId).toBe("contact-me");
  });

  it("clears due dates unless they are kept", () => {
    expect(cloneSubtasks([source()], options(), "me")[0]!.dueDate).toBeNull();
    expect(
      cloneSubtasks([source()], options({ keepDueDates: true }), "me")[0]!.dueDate,
    ).toEqual(DUE);
  });

  it("preserves the relative ordering of the copied subtasks", () => {
    const clones = cloneSubtasks(
      [source({ sortOrder: 1000 }), source({ sortOrder: 2000, boardOrder: 3000 })],
      options(),
      "me",
    );
    expect(clones.map((c) => c.sortOrder)).toEqual([1000, 2000]);
    expect(clones[1]!.boardOrder).toBe(3000);
  });

  it("carries the per-subtask reminder override", () => {
    expect(cloneSubtasks([source()], options(), "me")[0]!.alertAfterDays).toBe(5);
  });
});

describe("contactDeleteBlockReason", () => {
  it("allows deleting a contact that owns nothing", () => {
    expect(contactDeleteBlockReason("Priya", 0)).toBeNull();
  });

  it("blocks deleting a contact that still owns subtasks", () => {
    expect(contactDeleteBlockReason("Priya", 3)).toBe(
      "Priya is in use by 3 subtasks. Reassign them first.",
    );
  });

  it("gets the singular right", () => {
    expect(contactDeleteBlockReason("Priya", 1)).toBe(
      "Priya is in use by 1 subtask. Reassign them first.",
    );
  });
});
