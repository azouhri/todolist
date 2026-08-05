"use client";

import { useState } from "react";

import { updateSettings } from "@/app/actions/settings";
import { SearchableSelect } from "@/components/common/searchable-select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "@/hooks/use-action";

export function SettingsForm({
  defaultAlertAfterDays,
  defaultOwnerId,
  contacts,
}: {
  defaultAlertAfterDays: number;
  defaultOwnerId: string | null;
  contacts: { id: string; name: string }[];
}) {
  const [days, setDays] = useState(String(defaultAlertAfterDays));
  const [ownerId, setOwnerId] = useState<string>(defaultOwnerId ?? "");
  const { run, isPending } = useAction();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    run(() =>
      updateSettings({
        defaultAlertAfterDays: Number(days),
        defaultOwnerId: ownerId === "" ? null : ownerId,
      }),
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid max-w-xs gap-2">
            <Label htmlFor="default-alert">Chase after (days)</Label>
            <Input
              id="default-alert"
              type="number"
              min={0}
              max={365}
              step={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="tabular-nums"
            />
          </div>

          <div className="grid max-w-xs gap-2">
            <Label>Default owner for new subtasks</Label>
            <SearchableSelect
              value={ownerId}
              onChange={setOwnerId}
              options={[
                { value: "", label: "No default" },
                ...contacts.map((c) => ({ value: c.id, label: c.name })),
              ]}
              ariaLabel="Default owner for new subtasks"
              searchPlaceholder="Search contacts…"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            Save settings
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
