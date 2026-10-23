import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Overlay gallery",
  robots: { index: false, follow: false },
};

/**
 * /overlay/gallery: every element of every overlay package from the demo
 * match, for building and screenshotting packages. Local only: a
 * production build answers 404, like /design.
 */
export default function OverlayGalleryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
