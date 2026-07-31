"use client";

import { useState } from "react";

import { createContact, updateContact, type ContactInput } from "@/app/actions/contacts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";

export type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  team: string | null;
  notes: string | null;
  isSelf: boolean;
};

function toInput(contact?: ContactRow): ContactInput {
  return {
    name: contact?.name ?? "",
    email: contact?.email ?? "",
    team: contact?.team ?? "",
    notes: contact?.notes ?? "",
    isSelf: contact?.isSelf ?? false,
  };
}

export function ContactDialog({
  open,
  onOpenChange,
  contact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit to create a new contact. */
  contact?: ContactRow;
}) {
  const [form, setForm] = useState<ContactInput>(() => toInput(contact));
  const { run, isPending } = useAction();

  // Reset the form whenever the dialog opens for a different contact.
  const [lastKey, setLastKey] = useState(contact?.id ?? "new");
  const key = contact?.id ?? "new";
  if (open && key !== lastKey) {
    setLastKey(key);
    setForm(toInput(contact));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    run(() => (contact ? updateContact(contact.id, form) : createContact(form)), {
      onSuccess: () => onOpenChange(false),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{contact ? "Edit contact" : "New contact"}</DialogTitle>
            <DialogDescription>
              Contacts are the people who owe you things.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
                autoFocus
                required
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-team">Team</Label>
                <Input
                  id="contact-team"
                  value={form.team}
                  onChange={(e) => setForm({ ...form, team: e.target.value })}
                  placeholder="Platform"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contact-notes">Notes</Label>
              <Textarea
                id="contact-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Best reached on Slack, slow over email."
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isSelf}
                onCheckedChange={(checked) =>
                  setForm({ ...form, isSelf: checked === true })
                }
              />
              This is me
              <span className="text-muted-foreground">
                (only one contact can be)
              </span>
            </label>
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              }
            />
            <Button type="submit" disabled={isPending}>
              {contact ? "Save changes" : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
