"use client";

import {
  AccountCard,
  CreateSection,
  InvitesSection,
  PlacesSection,
  SettingsSection,
} from "~/components/layout/account-sections";
import { PageContainer, PageHeader } from "~/components/layout/page";
import { useAuth } from "~/lib/auth";

/**
 * The last tab: a real page, so Back, reload and sharing work. It holds what
 * has no tab (Teams, Players, the account) and repeats no tab. On tablets and
 * desktop the sidebar and the header's menus hold the same things.
 */
export default function MorePage() {
  const { user } = useAuth();
  return (
    <PageContainer size="narrow">
      <PageHeader title="More" search />
      <AccountCard />
      <PlacesSection />
      {user && <CreateSection />}
      {user && <InvitesSection />}
      <SettingsSection />
    </PageContainer>
  );
}
