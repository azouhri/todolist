"use client";

import { useMemo, useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { deleteContact } from "@/app/actions/contacts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";

import { ContactDialog, type ContactRow } from "./contact-dialog";

export type ContactListItem = ContactRow & { subtaskCount: number };

export function ContactsView({ contacts }: { contacts: ContactListItem[] }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ContactRow | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ContactListItem | null>(null);
  const { run, isPending } = useAction();

  function openNew() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(contact: ContactRow) {
    setEditing(contact);
    setDialogOpen(true);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    run(() => deleteContact(id), {
      onSuccess: () => setPendingDelete(null),
      // Blocked deletes (contact still owns subtasks) stay open so the
      // message and the row are visible together.
    });
  }

  // Name, email and team all searchable: you rarely remember which one you know.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter((c) =>
      `${c.name} ${c.email ?? ""} ${c.team ?? ""}`.toLowerCase().includes(needle),
    );
  }, [contacts, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Contacts</h1>
        <Button onClick={openNew}>
          <PlusIcon /> New contact
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or team…"
          className="h-8 w-full sm:w-80"
        />
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {visible.length} of {contacts.length}
        </span>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Subtasks</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {contacts.length === 0
                    ? "No contacts yet."
                    : "No contacts match that search."}
                </TableCell>
              </TableRow>
            )}

            {visible.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    {contact.name}
                    {contact.isSelf && <Badge variant="secondary">Me</Badge>}
                  </span>
                  {contact.notes && (
                    <span className="mt-0.5 block max-w-md truncate text-xs text-muted-foreground">
                      {contact.notes}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.email ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.team ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {contact.subtaskCount}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${contact.name}`}
                      onClick={() => openEdit(contact)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${contact.name}`}
                      onClick={() => setPendingDelete(contact)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editing}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && pendingDelete.subtaskCount > 0
                ? `${pendingDelete.name} still owns ${pendingDelete.subtaskCount} subtask${
                    pendingDelete.subtaskCount === 1 ? "" : "s"
                  }. Reassign them before deleting.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline">Cancel</Button>} />
            <AlertDialogAction
              render={
                <Button
                  variant="destructive"
                  disabled={isPending || (pendingDelete?.subtaskCount ?? 0) > 0}
                />
              }
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
