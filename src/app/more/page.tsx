"use client";

import {
  AccountCard,
  CreateSection,
  InvitesSection,
  SettingsSection,
} from "~/components/layout/account-sections";
import { PageContainer, PageHeader } from "~/components/layout/page";
import { useAuth } from "~/lib/auth";

/**
 * The last tab: a real page, so Back, reload and sharing work. It holds what
 * has no place of its own and repeats no tab. On tablets and desktop the
 * header's menus hold the same things.
 */
export default function MorePage() {
  const { user } = useAuth();
  return (
    <PageContainer size="narrow">
      <PageHeader title="More" search />
      <AccountCard />
      {user && <CreateSection />}
      {user && <InvitesSection />}
      <SettingsSection />
    </PageContainer>
  );
}
