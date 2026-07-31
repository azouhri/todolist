import "server-only";

import { attempt, fail, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Wrapper for every mutating server action.
 *
 * Server Actions are plain POST endpoints and can be invoked directly, not just
 * through the UI — the proxy redirect does not protect them. So each one
 * re-verifies the session here before touching the database.
 *
 * This is a single-account app, so "authenticated" is the whole authorisation
 * model; there is no per-row ownership to check.
 */
export async function guarded<T>(
  fn: () => Promise<ActionResult<T>>,
  fallbackMessage?: string,
): Promise<ActionResult<T>> {
  const user = await getCurrentUser();
  if (!user) return fail("You are signed out. Sign in again to continue.");

  return attempt(fn, fallbackMessage);
}
