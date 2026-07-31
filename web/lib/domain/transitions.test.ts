import { describe, expect, it } from "vitest";

import { applyStatusTransition } from "./transitions";

const NOW = new Date("2026-07-30T10:00:00Z");
const EARLIER = new Date("2026-07-18T10:00:00Z");

describe("applyStatusTransition", () => {
  it("starts the waiting clock the first time a subtask is requested", () => {
    const result = applyStatusTransition("not_started", "waiting", null, NOW);

    expect(result.patch.requestedDate).toEqual(NOW);
    expect(result.event?.type).toBe("requested");
    expect(result.notice).toBe("Waiting clock started.");
  });

  it("keeps the original requestedDate when returning to waiting", () => {
    const result = applyStatusTransition("blocked", "waiting", EARLIER, NOW);

    // Re-entering waiting must not restart daysWaiting.
    expect(result.patch.requestedDate).toBeUndefined();
    expect(result.event?.type).toBe("status_change");
    expect(result.notice).toBeNull();
  });

  it("stamps completedAt when a subtask is done", () => {
    const result = applyStatusTransition("waiting", "done", EARLIER, NOW);

    expect(result.patch.completedAt).toEqual(NOW);
    expect(result.patch.status).toBe("done");
  });

  it("clears both clocks when reset to not_started", () => {
    const result = applyStatusTransition("waiting", "not_started", EARLIER, NOW);

    expect(result.patch.requestedDate).toBeNull();
    expect(result.patch.completedAt).toBeNull();
    expect(result.notice).toBe("Waiting and reminder clocks cleared.");
  });

  it("does not announce cleared clocks when there were none", () => {
    const result = applyStatusTransition("in_progress", "not_started", null, NOW);
    expect(result.notice).toBeNull();
  });

  it("clears completedAt when a done subtask is reopened", () => {
    const result = applyStatusTransition("done", "in_progress", EARLIER, NOW);
    expect(result.patch.completedAt).toBeNull();
  });

  it("records every transition in the timeline", () => {
    const result = applyStatusTransition("in_progress", "blocked", null, NOW);
    expect(result.event).toEqual({
      type: "status_change",
      note: "In progress → Blocked",
    });
  });
});
