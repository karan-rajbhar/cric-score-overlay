import "~/styles/globals.css";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { TRPCReactProvider } from "~/trpc/react";
import { AuthProvider } from "~/lib/auth";
import { ThemeProvider } from "~/lib/theme-provider";
import { NavigationBar } from "~/components/NavigationBar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Cricket Platform - Live Scoring & Management",
  description: "Professional cricket match scoring and club management platform with real-time updates",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  keywords: "cricket, scoring, live, management, tournament, OBS, streaming",
  authors: [{ name: "Cricket Platform Team" }],
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${inter.variable} antialiased overflow-x-hidden`}>
        <ThemeProvider
          defaultTheme="dark"
        >
          <TRPCReactProvider cookies={cookies().toString()}>
            <AuthProvider>
              <div className="min-h-screen relative">
                {/* Modern Background with Dynamic Theming */}
                <div className="fixed inset-0 -z-10">
                  <div className="absolute inset-0 bg-gradient-to-br from-background via-cricket-primary/5 to-background"></div>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--cricket-primary)_/_0.05),transparent_50%)]"></div>
                  <div
                    className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23${encodeURIComponent('currentColor')}' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                    }}
                  ></div>
                </div>

                <NavigationBar />

                <main className="relative">
                  {children}
                </main>

                {/* Modern Footer */}
                <footer className="relative mt-20 border-t border-border/50 bg-card/30 backdrop-blur-sm">
                  <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                    <div className="text-center space-y-4">
                      <p className="text-muted-foreground">
                        © 2025 Cricket Platform. Built for cricket enthusiasts worldwide.
                      </p>
                      <div className="flex justify-center space-x-6 text-sm text-muted-foreground">
                        <a href="#" className="hover:text-cricket-primary transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-cricket-secondary transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-cricket-accent transition-colors">Support</a>
                      </div>
                    </div>
                  </div>
                </footer>
              </div>
            </AuthProvider>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}