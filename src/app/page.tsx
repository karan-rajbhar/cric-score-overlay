import { redirect } from "next/navigation";
import { LandingPage } from "~/components/home/landing-page";
import { getInitialUser } from "~/lib/firebase/initial-user";

/**
 * Home: the landing page, or a signed-in user's own home. Checked on the
 * server from the session cookie (a local check, no Firestore read), so the
 * logo and Home always lead to one place.
 */
export default async function HomePage() {
  if (await getInitialUser()) redirect("/dashboard");
  return <LandingPage />;
}
