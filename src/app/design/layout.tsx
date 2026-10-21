import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

/**
 * /design: the design system reference (tokens in globals.css, components
 * in ~/components/ds). Local only: a production build answers 404, so it
 * never ships.
 */
export default function DesignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
