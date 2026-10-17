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
const C = {
  background: "hsl(150 12% 96.5%)",
  card: "#ffffff",
  border: "hsl(150 9% 87%)",
  foreground: "hsl(160 28% 10%)",
  muted: "hsl(160 7% 36%)",
  primary: "hsl(155 58% 26%)",
  live: "hsl(0 66% 44%)",
};

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
          <div style={{ display: "flex", fontWeight: 600, color: C.primary }}>
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
