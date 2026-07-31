/**
 * Spec §5.4: drops write a float midpoint between the neighbours, and the list
 * is silently reindexed when the neighbours get too close to split again.
 */

/** Below this the midpoint stops being meaningfully distinct from its neighbours. */
export const MIN_ORDER_GAP = 0.0001;

/** Spacing used when appending or reindexing. */
export const ORDER_STEP = 1000;

/**
 * The order value for an item dropped between `prev` and `next`.
 * Pass undefined for prev when dropping at the top, next when at the bottom.
 */
export function nextSortOrder(prev?: number, next?: number): number {
  if (prev === undefined && next === undefined) return ORDER_STEP;
  if (prev === undefined) return next! - ORDER_STEP;
  if (next === undefined) return prev + ORDER_STEP;
  return (prev + next) / 2;
}

/** True when the neighbours are too close to fit another midpoint between them. */
export function needsReindex(prev?: number, next?: number): boolean {
  if (prev === undefined || next === undefined) return false;
  return Math.abs(next - prev) < MIN_ORDER_GAP;
}

/**
 * Evenly spaced order values for a list that has been squeezed flat.
 * Returned in the same order as the ids passed in.
 */
export function reindexOrders(ids: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  ids.forEach((id, index) => result.set(id, (index + 1) * ORDER_STEP));
  return result;
}

/**
 * Resolve a drop into the order value to persist, plus whether the caller
 * should follow up with a full reindex of the list.
 */
export function resolveDrop(
  orderedValues: readonly number[],
  targetIndex: number,
): { order: number; reindex: boolean } {
  const prev = targetIndex > 0 ? orderedValues[targetIndex - 1] : undefined;
  const next =
    targetIndex < orderedValues.length ? orderedValues[targetIndex] : undefined;

  return {
    order: nextSortOrder(prev, next),
    reindex: needsReindex(prev, next),
  };
}
