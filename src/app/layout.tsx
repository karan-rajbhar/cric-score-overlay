import "~/styles/globals.css";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "~/lib/auth";
import { ErrorReporter } from "~/components/error-reporter";
import { ServiceWorkerRegistrar } from "~/components/pwa/service-worker-registrar";
import { ViewportVars } from "~/components/viewport-vars";
import { QueryProvider } from "~/providers/query-provider";
import { ThemeProvider } from "~/lib/theme-provider";
import { AppShell } from "~/components/layout/app-shell";
import type { Metadata, Viewport } from "next";

// One family, two widths: Barlow for reading, Barlow Condensed for figures.
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-score",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CricScore — Live Cricket Scoring & Overlay",
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
    { media: "(prefers-color-scheme: light)", color: "#f5f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1411" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              prerender: [
                {
                  where: { href_matches: "/matches/*" },
                  eagerness: "moderate",
                },
                {
                  where: { href_matches: "/tournaments/*" },
                  eagerness: "moderate",
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className={`font-sans ${barlow.variable} ${barlowCondensed.variable} overflow-x-hidden antialiased`}
      >
        <ErrorReporter />
        <ViewportVars />
        <ThemeProvider defaultTheme="light">
          <AuthProvider>
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
