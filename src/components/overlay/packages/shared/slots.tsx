"use client";

/**
 * Crest and photo slots: a team's logo or a player's photo when the match
 * has one, else their initials (never a broken image: a logo or photo that
 * fails to load falls back too). Unstyled: the package sizes and paints
 * them through `className` / `style` and the inner `img` / text props.
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import { initialsOf, monogramOf } from "./derive";

/**
 * Whether to show an image at `url`: true until it fails to load; a new
 * url is tried again. For packages drawing their own markup.
 */
export function useImageFallback(url: string | null | undefined): {
  show: boolean;
  onError: () => void;
} {
  const [failed, setFailed] = useState<string | null>(null);
  return {
    show: !!url && failed !== url,
    onError: () => setFailed(url ?? null),
  };
}

interface SlotStyleProps {
  className?: string;
  style?: CSSProperties;
  imgClassName?: string;
  imgStyle?: CSSProperties;
  textClassName?: string;
  textStyle?: CSSProperties;
}

/**
 * A team's crest: its logo, else the initials of its name ("Riverside
 * Rangers" RR), else its code. Decorative (`aria-hidden`): the name is
 * always written beside it.
 */
export function CrestSlot({
  logo,
  name,
  code,
  className,
  style,
  imgClassName,
  imgStyle,
  textClassName,
  textStyle,
}: SlotStyleProps & {
  logo?: string | null;
  name?: string | null;
  code: string;
}) {
  const img = useImageFallback(logo);
  return (
    <span aria-hidden="true" data-crest="" className={className} style={style}>
      {img.show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo!} alt="" onError={img.onError} className={imgClassName} style={imgStyle} />
      ) : (
        <span className={textClassName} style={textStyle}>
          {monogramOf(name, code)}
        </span>
      )}
    </span>
  );
}

/**
 * A player's photo slot: their avatar, else `fallback` (a silhouette, say)
 * or their initials. Decorative (`aria-hidden`).
 */
export function AvatarSlot({
  url,
  name,
  fallback,
  className,
  style,
  imgClassName,
  imgStyle,
  textClassName,
  textStyle,
  children,
}: SlotStyleProps & {
  url?: string | null;
  name?: string | null;
  /** Drawn instead of the initials when there is no photo. */
  fallback?: ReactNode;
  /** Drawn over the photo or fallback (a gloss, a frame). */
  children?: ReactNode;
}) {
  const img = useImageFallback(url);
  return (
    <span aria-hidden="true" data-avatar="" className={className} style={style}>
      {img.show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url!} alt="" onError={img.onError} className={imgClassName} style={imgStyle} />
      ) : (
        (fallback ?? (
          <span className={textClassName} style={textStyle}>
            {initialsOf(name)}
          </span>
        ))
      )}
      {children}
    </span>
  );
}
