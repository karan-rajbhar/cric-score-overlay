import { redirect } from "next/navigation";
import { createServerClient } from "~/lib/firebase/server";
import { PageContainer, PageHeader } from "~/components/layout/page";
import { InviteDialog } from "~/components/invite-dialog";
import { SentInvitesList } from "~/components/invitations/sent-invites-list";
import { listSentInvitations, SENT_INVITES_LIMIT } from "./data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Invites — CricScore" };

export default async function InvitationsPage() {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/invitations");

  const invites = await listSentInvitations(db, user.id);
  const inviterName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : undefined;

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Invites"
        description={`People you invited to CricScore. Showing the latest ${SENT_INVITES_LIMIT}.`}
        actions={<InviteDialog />}
      />
      <SentInvitesList invites={invites} inviterName={inviterName} />
    </PageContainer>
  );
}
