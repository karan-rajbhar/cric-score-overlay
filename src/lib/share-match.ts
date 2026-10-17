/**
 * Sharing a match link: the system share sheet on phones (WhatsApp, SMS,
 * …), else copy to clipboard, else WhatsApp. The link opens the public
 * match page, whose Open Graph metadata gives the score-card preview.
 */

export interface ShareScore {
  team1?: string | null;
  team2?: string | null;
  battingTeam?: string | null;
  runs?: number | null;
  wickets?: number | null;
  overs?: string | null;
  status?: string | null;
}

export function matchShareUrl(matchId: string): string {
  return `${window.location.origin}/matches/${matchId}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** "Team A vs Team B", falling back gracefully when names are missing. */
export function matchTitle(score: ShareScore): string {
  const a = score.team1?.trim();
  const b = score.team2?.trim();
  return a && b ? `${a} vs ${b}` : a || b || "Cricket match";
}

/**
 * Message for a live share, e.g.
 * "Live: Strikers 85/3 (10.2 ov) — Strikers vs Warriors. Follow ball by ball:"
 */
export function liveShareText(score: ShareScore): string {
  const title = matchTitle(score);
  if (score.status === "live" && score.battingTeam && score.runs != null) {
    const overs = score.overs ? ` (${score.overs} ov)` : "";
    return `Live: ${score.battingTeam} ${score.runs}/${score.wickets ?? 0}${overs} — ${title}. Follow ball by ball:`;
  }
  return `${title} on CricScore:`;
}

export type ShareOutcome = "shared" | "copied" | "whatsapp" | "cancelled";

/**
 * Without `text`, shares just the title and link and copies just the link
 * (the match page's plain share); with it, the message goes along too.
 */
export async function shareMatch(
  url: string,
  title: string,
  text?: string,
): Promise<ShareOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(text ? { title, text, url } : { title, url });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  try {
    await navigator.clipboard.writeText(text ? `${text}\n${url}` : url);
    return "copied";
  } catch {
    window.open(
      whatsappShareUrl(`${text ?? title}\n${url}`),
      "_blank",
      "noopener,noreferrer",
    );
    return "whatsapp";
  }
}
