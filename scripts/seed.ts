import "../lib/load-env";

import { createServiceClient } from "../lib/supabase/data";
import { DEFAULT_OWNER_NAME, SETTINGS_ID } from "../lib/domain/settings";

/**
 * Idempotent: safe to re-run. `npm run db:seed`.
 * Uses the service role key, so run it locally only.
 */
async function main() {
  const supabase = createServiceClient();

  const { data: existingSelf } = await supabase
    .from("contacts")
    .select("id, name")
    .eq("is_self", true)
    .limit(1)
    .maybeSingle();

  const self =
    existingSelf ??
    (
      await supabase
        .from("contacts")
        .insert({ name: "Me", is_self: true })
        .select("id, name")
        .single()
    ).data;

  // The usual counterparty, pre-selected on new subtasks so it never has to be
  // typed. Changeable on the Settings page.
  const { data: existingDefault } = await supabase
    .from("contacts")
    .select("id, name")
    .eq("name", DEFAULT_OWNER_NAME)
    .limit(1)
    .maybeSingle();

  const defaultOwner =
    existingDefault ??
    (
      await supabase
        .from("contacts")
        .insert({ name: DEFAULT_OWNER_NAME })
        .select("id, name")
        .single()
    ).data;

  const { data: settings } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  if (!settings) {
    await supabase.from("app_settings").insert({
      id: SETTINGS_ID,
      default_alert_after_days: 3,
      default_owner_id: (defaultOwner as { id: string } | null)?.id ?? null,
    });
  } else if (!(settings as { default_owner_id: string | null }).default_owner_id) {
    // Only fill the default owner in if one has not been chosen already.
    await supabase
      .from("app_settings")
      .update({ default_owner_id: (defaultOwner as { id: string } | null)?.id ?? null })
      .eq("id", SETTINGS_ID);
  }

  console.log(
    `Seeded: self "${(self as { name: string } | null)?.name}", default owner "${
      (defaultOwner as { name: string } | null)?.name
    }".`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
