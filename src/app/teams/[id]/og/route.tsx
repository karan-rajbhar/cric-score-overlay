import { ImageResponse } from "next/og";
import {
  OG_COLORS as C,
  OG_SIZE,
  OG_TITLE_STYLE,
  OgBadge,
  OgFrame,
} from "~/components/og/og-kit";
import { teamCard } from "~/lib/share-cards";
import { loadShareTeam } from "~/lib/share-card-server";

/**
 * Link preview image for a team (1200x630): its name in its colour, its
 * club, squad size and captain. One or two reads (the team, its club),
 * only when a link is shared.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadShareTeam(id);
  const card = loaded ? teamCard(loaded.team, loaded.clubName) : null;

  return new ImageResponse(
    (
      <OgFrame aside={card ? "Team" : undefined}>
        {card ? (
          <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
            <OgBadge initials={card.initials} color={card.color} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={OG_TITLE_STYLE}>{card.name}</div>
              {card.detail && (
                <div style={{ fontSize: 32, color: C.muted, marginTop: 10, maxWidth: 860, overflow: "hidden", whiteSpace: "nowrap" }}>
                  {card.detail}
                </div>
              )}
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
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
