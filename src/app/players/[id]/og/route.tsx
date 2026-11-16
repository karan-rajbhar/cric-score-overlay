import { ImageResponse } from "next/og";
import {
  OG_COLORS as C,
  OG_SIZE,
  OG_TITLE_STYLE,
  OgBadge,
  OgFrame,
  OgStat,
} from "~/components/og/og-kit";
import { playerCard } from "~/lib/share-cards";
import { loadSharePlayer } from "~/lib/share-card-server";

/**
 * Link preview image for a player (1200x630): their name, role and career
 * figures. Two reads (the profile and `player_career_stats`), only when a
 * link is shared: the page's metadata names this route, a page view never
 * fetches it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadSharePlayer(id);
  const card = loaded ? playerCard(loaded.user, loaded.stats) : null;

  return new ImageResponse(
    (
      <OgFrame aside={card ? "Player" : undefined}>
        {card ? (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 40 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <OgBadge initials={card.initials} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={OG_TITLE_STYLE}>{card.name}</div>
                {card.detail && (
                  <div style={{ fontSize: 30, color: C.muted, marginTop: 8, maxWidth: 860, overflow: "hidden", whiteSpace: "nowrap" }}>
                    {card.detail}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              {card.figures.map((f) => (
                <OgStat key={f.label} value={f.value} label={f.label} />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flex: 1, alignItems: "center", fontSize: 64, fontWeight: 600, color: C.foreground }}>
            Cricket scores and statistics
          </div>
        )}
      </OgFrame>
    ),
    {
      ...OG_SIZE,
      // Figures change with each match the player plays.
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    },
  );
}
