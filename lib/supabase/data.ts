import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import { createClient as createRequestClient } from "./server";

/**
 * The Supabase client used for data access.
 *
 * Inside a Next request it is the cookie-backed client, so every query runs as
 * the signed-in user and RLS applies. Outside one — the MCP server, seed and
 * import scripts — `cookies()` is unavailable, so it falls back to a service
 * role client. That key bypasses RLS and must never reach the browser; it is
 * read from the server-only environment.
 */
export async function getDataClient(): Promise<SupabaseClient> {
  try {
    return await createRequestClient();
  } catch {
    return createServiceClient();
  }
}

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Running outside a request needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * PostgREST reports failures in the response rather than throwing. This turns
 * one into an exception so callers cannot silently treat an error as no rows.
 */
export function unwrap<T>(
  result: { data: T | null; error: { message: string } | null },
  context: string,
): T {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${context}: no data returned`);
  return result.data;
}
