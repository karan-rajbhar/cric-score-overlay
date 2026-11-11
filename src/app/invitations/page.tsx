import { redirect } from "next/navigation";
import { createServerClient } from "~/lib/firebase/server";
import { PageContainer, PageHeader } from "~/components/layout/page";
import { InviteDialog } from "~/components/invite-dialog";
import { Button } from "~/components/ui/button";
import { UserPlus } from "lucide-react";
import { SentInvitesList } from "~/components/invitations/sent-invites-list";
import { listSentInvitations, SENT_INVITES_LIMIT } from "./data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Invites" };

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
        back={{ href: "/more", label: "Back to More" }}
        title="Invites"
        description={
          // The limit, only when the list reaches it (N36).
          invites.length >= SENT_INVITES_LIMIT
            ? `People you invited to CricScore. Showing the latest ${SENT_INVITES_LIMIT}.`
            : "People you invited to CricScore."
        }
        // The page's one action: primary, 44px (N36).
        actions={
          <InviteDialog
            trigger={
              <Button>
                <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
                Invite
              </Button>
            }
          />
        }
      />
      <SentInvitesList invites={invites} inviterName={inviterName} />
    </PageContainer>
  );
}
