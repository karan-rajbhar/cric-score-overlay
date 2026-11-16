import type * as React from "react";

/*
 * Pieces shared by the link preview images (`next/og`, 1200x630): the
 * match's (`/matches/<id>/og`), a player's and a team's. The calm light
 * theme of the app; Satori draws flexbox only (every element with children
 * says `display: flex`).
 */

export const OG_SIZE = { width: 1200, height: 630 };

// The light theme's tokens (src/styles/globals.css).
export const OG_COLORS = {
  background: "hsl(230 40% 98.5%)",
  card: "#ffffff",
  border: "hsl(230 25% 91%)",
  foreground: "hsl(236 45% 12%)",
  muted: "hsl(233 12% 44%)",
  brand: "hsl(228 55% 40%)",
  brandSoft: "hsl(236 80% 96.5%)",
  live: "hsl(0 72% 51%)",
};
const C = OG_COLORS;

/** The brand mark, as in src/app/icon.svg. */
export function OgMark() {
  return (
    <svg width={44} height={44} viewBox="0 0 32 32" style={{ marginRight: 14 }}>
      <rect width={32} height={32} rx={9} fill={C.brand} />
      <rect x={8} y={10.5} width={4} height={15.5} rx={2} fill={C.card} />
      <rect x={14} y={10.5} width={4} height={15.5} rx={2} fill={C.card} />
      <rect x={20} y={10.5} width={4} height={15.5} rx={2} fill={C.card} />
      <rect x={8} y={6.5} width={7} height={2} rx={1} fill={C.card} />
      <rect x={17} y={6.5} width={7} height={2} rx={1} fill={C.card} />
    </svg>
  );
}

/** The page frame: the brand at the top left, `aside` at the top right. */
export function OgFrame({
  aside,
  children,
  footer,
}: {
  aside?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 56,
        background: C.background,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 30,
          color: C.muted,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontWeight: 600,
            color: C.foreground,
          }}
        >
          <OgMark />
          CricScore
        </div>
        {aside ? <div style={{ display: "flex" }}>{aside}</div> : null}
      </div>
      {children}
      {footer ? (
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: C.foreground,
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** A figure with its label under it ("312" / "Runs"). */
export function OgStat({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: "24px 28px",
        borderRadius: 20,
        background: C.card,
        border: `2px solid ${C.border}`,
      }}
    >
      <div style={{ fontSize: 64, fontWeight: 700, color: C.foreground, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 28, color: C.muted, marginTop: 10 }}>{label}</div>
    </div>
  );
}

/** A name with its initials in a circle (players and teams have no photo here). */
export function OgBadge({ initials, color }: { initials: string; color?: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 140,
        height: 140,
        borderRadius: 70,
        background: color || C.brandSoft,
        color: color ? "#ffffff" : C.brand,
        // A team's three-letter code fits the circle with room to spare.
        fontSize: initials.length > 2 ? 44 : 52,
        fontWeight: 700,
        marginRight: 36,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

/** A long name kept to one line. */
export const OG_TITLE_STYLE: React.CSSProperties = {
  fontSize: 68,
  fontWeight: 600,
  color: C.foreground,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  maxWidth: 860,
};
