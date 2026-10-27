import "~/styles/globals.css";
import { Barlow_Condensed, Outfit, Urbanist } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "~/lib/auth";
import { getInitialUser } from "~/lib/firebase/initial-user";
import { ErrorReporter } from "~/components/error-reporter";
import { ServiceWorkerRegistrar } from "~/components/pwa/service-worker-registrar";
import { ViewportVars } from "~/components/viewport-vars";
import { WebVitalsReporter } from "~/components/web-vitals-reporter";
import { QueryProvider } from "~/providers/query-provider";
import { ThemeProvider } from "~/lib/theme-provider";
import { AppShell } from "~/components/layout/app-shell";
import type { Metadata, Viewport } from "next";

// Urbanist for text; Outfit for figures (tabular digits, so scores don't
// shift as they change).
const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-score",
  display: "swap",
});

// The OBS overlay keeps its condensed broadcast face (AppShell points
// --font-score at it on /overlay). Not preloaded: only overlays fetch it.
const broadcast = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-broadcast",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  // Each page names itself: "<page> | CricScore".
  title: {
    default: "CricScore — Live Cricket Scoring & Overlay",
    template: "%s | CricScore",
  },
  description:
    "Ball-by-ball cricket scoring, live scorecards and club tournaments.",
  keywords: "cricket, scoring, live, management, tournament, OBS, streaming",
  authors: [{ name: "CricScore" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android: shrink the page when the on-screen keyboard opens so fixed
  // dialogs stay visible. iOS ignores this; ViewportVars covers it there.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafd" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c19" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read per request: the page is built for whoever is signed in, so a
  // signed-in visitor never gets a signed-out first paint.
  const initialUser = await getInitialUser();
  return (
    // data-scroll-behavior: the html element scrolls smoothly (globals.css),
    // and Next 16 switches that off during route changes only when asked, so
    // a new page starts at the top at once instead of gliding up to it.
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      {/* No speculation rules: navigation is client-side (next/link, which
          prefetches routes itself), so a prerendered document is never used
          but still costs a server render and Firestore reads and listeners. */}
      <body
        className={`font-sans ${urbanist.variable} ${outfit.variable} ${broadcast.variable} overflow-x-hidden antialiased`}
      >
        <ErrorReporter />
        <WebVitalsReporter />
        <ViewportVars />
        <ThemeProvider defaultTheme="light">
          <AuthProvider initialUser={initialUser}>
            <QueryProvider>
              <AppShell>{children}</AppShell>
              <Toaster richColors position="top-center" />
              <ServiceWorkerRegistrar />
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
