import { describe, expect, it } from "vitest";

import {
  MIN_ORDER_GAP,
  ORDER_STEP,
  needsReindex,
  nextSortOrder,
  reindexOrders,
  resolveDrop,
} from "./sort";

describe("nextSortOrder", () => {
  it("takes the midpoint between two neighbours", () => {
    expect(nextSortOrder(1000, 2000)).toBe(1500);
  });

  it("goes above the last item when dropped at the bottom", () => {
    expect(nextSortOrder(2000, undefined)).toBe(2000 + ORDER_STEP);
  });

  it("goes below the first item when dropped at the top", () => {
    expect(nextSortOrder(undefined, 1000)).toBe(1000 - ORDER_STEP);
  });

  it("handles the first item in an empty list", () => {
    expect(nextSortOrder(undefined, undefined)).toBe(ORDER_STEP);
  });

  it("still splits negative ranges", () => {
    expect(nextSortOrder(-2000, -1000)).toBe(-1500);
  });
});

describe("needsReindex", () => {
  it("is false for comfortably spaced neighbours", () => {
    expect(needsReindex(1000, 2000)).toBe(false);
  });

  it("is true once the gap collapses below the threshold", () => {
    expect(needsReindex(1, 1 + MIN_ORDER_GAP / 2)).toBe(true);
  });

  it("is false at the ends of the list, where there is nothing to split", () => {
    expect(needsReindex(undefined, 1000)).toBe(false);
    expect(needsReindex(1000, undefined)).toBe(false);
  });
});

describe("reindexOrders", () => {
  it("spaces every item evenly in the given order", () => {
    expect([...reindexOrders(["a", "b", "c"])]).toEqual([
      ["a", ORDER_STEP],
      ["b", ORDER_STEP * 2],
      ["c", ORDER_STEP * 3],
    ]);
  });
});

describe("resolveDrop", () => {
  const values = [1000, 2000, 3000];

  it("resolves a drop at the top", () => {
    expect(resolveDrop(values, 0)).toEqual({ order: 0, reindex: false });
  });

  it("resolves a drop in the middle", () => {
    expect(resolveDrop(values, 1)).toEqual({ order: 1500, reindex: false });
  });

  it("resolves a drop at the bottom", () => {
    expect(resolveDrop(values, 3)).toEqual({ order: 4000, reindex: false });
  });

  it("asks for a reindex when the neighbours are too close", () => {
    const tight = [1, 1 + MIN_ORDER_GAP / 4];
    expect(resolveDrop(tight, 1).reindex).toBe(true);
  });

  it("survives repeated drops into the same gap", () => {
    // Simulates dragging into the same slot until the floats collapse.
    let list = [0, 1];
    let sawReindex = false;
    for (let i = 0; i < 40 && !sawReindex; i += 1) {
      const { order, reindex } = resolveDrop(list, 1);
      sawReindex = reindex;
      list = [0, order];
    }
    expect(sawReindex).toBe(true);
  });
});
