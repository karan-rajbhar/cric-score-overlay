"use client";

import { useState } from "react";

/**
 * A profile photo that falls back to `fallback` (the initials) when it
 * cannot be loaded: a deleted or blocked photo URL shows the person's
 * initials, never a broken-image icon. Client only for the error state;
 * `Avatar` stays usable from server components.
 */
export function AvatarPhoto({
  src,
  className,
  fallback,
}: {
  src: string;
  className: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setFailed(src)}
    />
  );
}
