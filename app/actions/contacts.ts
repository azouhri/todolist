"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { contactDeleteBlockReason } from "@/lib/domain/clone";
import { guarded } from "@/lib/server-action";
import { getDataClient, unwrap } from "@/lib/supabase/data";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.email().safeParse(v).success, {
      message: "Enter a valid email address.",
    })
    .transform((v) => (v === "" ? null : v)),
  team: z
    .string()
    .trim()
    .max(120)
    .transform((v) => (v === "" ? null : v)),
  notes: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v === "" ? null : v)),
  isSelf: z.boolean(),
});

export type ContactInput = z.input<typeof contactSchema>;

function revalidateContacts() {
  revalidatePath("/", "layout");
}

/** Only one contact may be flagged as the local user. */
async function clearOtherSelf(exceptId: string) {
  const supabase = await getDataClient();
  const { error } = await supabase
    .from("contacts")
    .update({ is_self: false })
    .eq("is_self", true)
    .neq("id", exceptId);
  if (error) throw new Error(`clearOtherSelf: ${error.message}`);
}

export async function createContact(
  input: ContactInput,
): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid contact.");
    }
    const { name, email, team, notes, isSelf } = parsed.data;

    const supabase = await getDataClient();
    const contact = unwrap(
      await supabase
        .from("contacts")
        .insert({ name, email, team, notes, is_self: isSelf })
        .select("id, name")
        .single(),
      "createContact",
    ) as { id: string; name: string };

    if (isSelf) await clearOtherSelf(contact.id);

    revalidateContacts();
    return ok({ id: contact.id }, `Added ${contact.name}.`);
  });
}

export async function updateContact(
  id: string,
  input: ContactInput,
): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid contact.");
    }
    const { name, email, team, notes, isSelf } = parsed.data;

    const supabase = await getDataClient();
    const contact = unwrap(
      await supabase
        .from("contacts")
        .update({ name, email, team, notes, is_self: isSelf })
        .eq("id", id)
        .select("id, name")
        .single(),
      "updateContact",
    ) as { id: string; name: string };

    if (isSelf) await clearOtherSelf(contact.id);

    revalidateContacts();
    return ok({ id: contact.id }, `Saved ${contact.name}.`);
  });
}

/**
 * Deleting a contact that still owns subtasks would orphan the "who owes me
 * this" answer, so it is refused with a count the user can act on. (The schema
 * also restricts it at the database level.)
 */
export async function deleteContact(id: string): Promise<ActionResult> {
  return guarded(async () => {
    const supabase = await getDataClient();

    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, subtasks(id)")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`deleteContact/read: ${error.message}`);
    if (!data) return fail("That contact no longer exists.");

    const contact = data as {
      name: string;
      subtasks: { id: string }[] | null;
    };

    const blocked = contactDeleteBlockReason(
      contact.name,
      contact.subtasks?.length ?? 0,
    );
    if (blocked) return fail(blocked);

    const { error: deleteError } = await supabase
      .from("contacts")
      .delete()
      .eq("id", id);
    if (deleteError) throw new Error(`deleteContact: ${deleteError.message}`);

    revalidateContacts();
    return ok(undefined, `Deleted ${contact.name}.`);
  });
}
