import { PageContainer } from "@/components/layout/page-container";
import { ContactsView } from "@/components/contacts/contacts-view";
import { listContacts } from "@/lib/domain/queries";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contacts = await listContacts();

  return (
    <PageContainer>
      <ContactsView
        contacts={contacts}
      />
    </PageContainer>
  );
}
