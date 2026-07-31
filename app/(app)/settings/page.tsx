import { PageContainer } from "@/components/layout/page-container";
import { SettingsForm } from "@/components/settings/settings-form";
import { listContacts } from "@/lib/domain/queries";
import { getSettings } from "@/lib/domain/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, contacts] = await Promise.all([getSettings(), listContacts()]);

  return (
    <PageContainer className="max-w-2xl">
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <SettingsForm
          defaultAlertAfterDays={settings.defaultAlertAfterDays}
          defaultOwnerId={settings.defaultOwnerId}
          contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </PageContainer>
  );
}
