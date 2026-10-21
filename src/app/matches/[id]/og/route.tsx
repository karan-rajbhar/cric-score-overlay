import { ImageResponse } from "next/og";
import { matchShareSummary, type ShareSide } from "~/lib/match-share";
import { loadShareMatch } from "~/lib/match-share-server";

/**
 * Link preview image for a match (1200x630): the two teams and their
 * scores on the calm light theme. One read (the match document). Linked
 * from the page's Open Graph / Twitter metadata with a `?v=` score key, so
 * crawlers fetch a new image when the score changes.
 */

const SIZE = { width: 1200, height: 630 };
// The light theme's tokens (src/styles/globals.css).
const C = {
  background: "hsl(230 40% 98.5%)",
  card: "#ffffff",
  border: "hsl(230 25% 91%)",
  foreground: "hsl(236 45% 12%)",
  muted: "hsl(233 12% 44%)",
  brand: "hsl(228 55% 40%)",
  live: "hsl(0 72% 51%)",
};

/** The brand mark, as in src/app/icon.svg. */
function Mark() {
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

function Side({ side }: { side: ShareSide }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "28px 40px",
        borderRadius: 20,
        background: C.card,
        border: `2px solid ${C.border}`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
        <div
          style={{
            fontSize: 52,
            fontWeight: 600,
            color: C.foreground,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {side.name}
        </div>
        <div style={{ fontSize: 28, color: C.muted, marginTop: 6 }}>
          {side.note}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
        }}
      >
        <div
          style={{
            fontSize: 88,
            fontWeight: 700,
            color: C.foreground,
            lineHeight: 1,
          }}
        >
          {side.score ?? "-"}
        </div>
        {side.overs && (
          <div style={{ fontSize: 28, color: C.muted, marginTop: 8 }}>
            {`${side.overs} ov`}
          </div>
        )}
      </div>
    </div>
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const match = await loadShareMatch(id);
  const summary = match ? matchShareSummary(match) : null;
  const live = match?.status === "live";

  return new ImageResponse(
    (
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
            <Mark />
            CricScore
          </div>
          {summary && (
            <div style={{ display: "flex", alignItems: "center" }}>
              {live && (
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: C.live,
                    marginRight: 12,
                  }}
                />
              )}
              <div style={{ color: live ? C.live : C.muted, fontWeight: 600 }}>
                {summary.status}
              </div>
            </div>
          )}
        </div>

        {summary ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
              gap: 20,
            }}
          >
            <Side side={summary.sides[0]} />
            <Side side={summary.sides[1]} />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              fontSize: 64,
              fontWeight: 600,
              color: C.foreground,
            }}
          >
            Live cricket scoring
          </div>
        )}

        {summary?.footer && (
          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: C.foreground,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {summary.footer}
          </div>
        )}
      </div>
    ),
    {
      ...SIZE,
      headers: {
        // Live scores change; finished ones do not.
        "Cache-Control": live
          ? "public, max-age=60, s-maxage=60"
          : "public, max-age=3600, s-maxage=86400",
      },
    },
  );
}
