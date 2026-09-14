import "~/styles/globals.css";
import "~/styles/broadcast-suite.css";
import { Inter, Barlow_Condensed } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "~/lib/auth";
import { ThemeProvider } from "~/lib/theme-provider";
import { AppShell } from "~/components/layout/app-shell";
import type { Metadata, Viewport } from "next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-score",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CricScore — Live Cricket Scoring & Overlay",
  description:
    "Professional cricket match scoring and club management platform with real-time updates",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  keywords: "cricket, scoring, live, management, tournament, OBS, streaming",
  authors: [{ name: "CricScore" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`font-sans ${inter.variable} ${barlowCondensed.variable} overflow-x-hidden antialiased`}
      >
        <ThemeProvider defaultTheme="light">
          <AuthProvider>
            <AppShell>{children}</AppShell>
            <Toaster richColors position="top-center" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
