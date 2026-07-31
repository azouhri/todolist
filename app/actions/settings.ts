"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DEFAULT_ALERT_AFTER_DAYS, SETTINGS_ID } from "@/lib/domain/settings";
import { guarded } from "@/lib/server-action";
import { getDataClient } from "@/lib/supabase/data";

const settingsSchema = z.object({
  defaultAlertAfterDays: z
    .number()
    .int("Use a whole number of days.")
    .min(0, "Must be zero or more days.")
    .max(365, "That is longer than a year."),
  /** Empty string clears the default. */
  defaultOwnerId: z.string().nullable().optional(),
});

export async function updateSettings(input: {
  defaultAlertAfterDays: number;
  defaultOwnerId?: string | null;
}): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid settings.");
    }

    const { defaultAlertAfterDays, defaultOwnerId } = parsed.data;
    const supabase = await getDataClient();

    if (defaultOwnerId) {
      const { data } = await supabase
        .from("contacts")
        .select("id")
        .eq("id", defaultOwnerId)
        .maybeSingle();
      if (!data) return fail("That contact no longer exists.");
    }

    const { error } = await supabase.from("app_settings").upsert({
      id: SETTINGS_ID,
      default_alert_after_days: defaultAlertAfterDays ?? DEFAULT_ALERT_AFTER_DAYS,
      ...(defaultOwnerId !== undefined ? { default_owner_id: defaultOwnerId } : {}),
    });

    if (error) throw new Error(`updateSettings: ${error.message}`);

    // The default feeds every subtask without an override, so every clock moves.
    revalidatePath("/", "layout");
    return ok(undefined, "Settings saved.");
  });
}
