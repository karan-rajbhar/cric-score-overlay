import type { Metadata } from "next";

/** The page's title (the page itself is a client component). */
export const metadata: Metadata = { title: "New team" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
