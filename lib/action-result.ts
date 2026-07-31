/**
 * Every server action returns this shape instead of throwing, so the client can
 * toast a useful message and roll back optimistic state.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T, message?: string): ActionResult<T>;
export function ok<T>(data?: T, message?: string): ActionResult<T | undefined> {
  return { ok: true, data, message };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * Wraps an action body so an unexpected throw becomes a failed result rather
 * than a Next.js error overlay.
 */
export async function attempt<T>(
  fn: () => Promise<ActionResult<T>>,
  fallbackMessage = "Something went wrong. Please try again.",
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    console.error(error);
    return fail(error instanceof Error ? error.message : fallbackMessage);
  }
}
