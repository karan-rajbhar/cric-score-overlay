import type { Metadata } from "next";

/**
 * The page's title (the page itself is a client component). A template
 * too: a plain string would replace the root's "%s | CricScore" for every
 * page below (N19).
 */
export const metadata: Metadata = {
  title: { default: "Matches", template: "%s | CricScore" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
