import "~/styles/globals.css";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { TRPCReactProvider } from "~/trpc/react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Cricket Platform - Live Scoring & Management",
  description: "Professional cricket match scoring and club management platform",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`font-sans ${inter.variable} antialiased`}>
        <TRPCReactProvider cookies={cookies().toString()}>
          <div className="min-h-screen bg-gradient-to-br from-cricket-green to-cricket-field">
            <nav className="border-b border-white/10 bg-white/5 backdrop-blur-sm">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                  <div className="flex items-center">
                    <h1 className="text-xl font-bold text-white">
                      🏏 Cricket Platform
                    </h1>
                  </div>
                  <div className="flex items-center space-x-4">
                    <a 
                      href="/dashboard" 
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      Dashboard
                    </a>
                    <a 
                      href="/matches" 
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      Matches
                    </a>
                    <a 
                      href="/clubs" 
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      Clubs
                    </a>
                  </div>
                </div>
              </div>
            </nav>
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </TRPCReactProvider>
      </body>
    </html>
  );
} 