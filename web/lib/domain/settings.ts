import "server-only";

import { getDataClient, unwrap } from "@/lib/supabase/data";
import { toSettings, type AppSettings, type AppSettingsRow } from "@/lib/supabase/rows";

/** app_settings is a single row; this is its fixed primary key. */
export const SETTINGS_ID = "singleton";

export const DEFAULT_ALERT_AFTER_DAYS = 3;

/** Contact pre-selected as the owner of new subtasks (see scripts/seed.ts). */
export const DEFAULT_OWNER_NAME = "Moov Benin";

/**
 * Reads the settings row, creating it on first use so a fresh database (or one
 * restored without the seed) still works.
 */
export async function getSettings(): Promise<AppSettings> {
  const supabase = await getDataClient();

  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  if (error) throw new Error(`getSettings: ${error.message}`);
  if (data) return toSettings(data as AppSettingsRow);

  const created = unwrap(
    await supabase
      .from("app_settings")
      .insert({
        id: SETTINGS_ID,
        default_alert_after_days: DEFAULT_ALERT_AFTER_DAYS,
      })
      .select()
      .single(),
    "getSettings/create",
  ) as AppSettingsRow;

  return toSettings(created);
}

/**
 * The owner a new subtask should start with: the configured default, else the
 * "me" contact, else whatever contact exists.
 */
export async function getDefaultOwnerId(): Promise<string | null> {
  const supabase = await getDataClient();
  const settings = await getSettings();

  if (settings.defaultOwnerId) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", settings.defaultOwnerId)
      .maybeSingle();
    if (data) return (data as { id: string }).id;
  }

  const { data: fallback } = await supabase
    .from("contacts")
    .select("id")
    .order("is_self", { ascending: false })
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (fallback as { id: string } | null)?.id ?? null;
}
