import "~/styles/globals.css";
import { Inter, Barlow_Condensed } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "~/lib/auth";
import { ThemeProvider } from "~/lib/theme-provider";
import { NavigationBar } from "~/components/navigation-bar";
import type { Metadata, Viewport } from "next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-score",
});

export const metadata: Metadata = {
  title: "CricScore — Live Cricket Scoring & Overlay",
  description: "Professional cricket match scoring and club management platform with real-time updates",
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
      <body className={`font-sans ${inter.variable} ${barlowCondensed.variable} antialiased overflow-x-hidden`}>
        <ThemeProvider defaultTheme="dark">
          <AuthProvider>
            <div className="min-h-screen flex flex-col">
              <NavigationBar />
              <main className="flex-1">
                {children}
              </main>

              <footer className="border-t border-border">
                <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                  <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                    <p className="text-xs text-muted-foreground">
                      © 2025 CricScore. Live scoring for every level of the game.
                    </p>
                    <div className="flex gap-5 text-xs text-muted-foreground">
                      <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
                      <a href="#" className="hover:text-foreground transition-colors">Terms</a>
                      <a href="#" className="hover:text-foreground transition-colors">Support</a>
                    </div>
                  </div>
                </div>
              </footer>
            </div>
            <Toaster richColors position="top-center" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
