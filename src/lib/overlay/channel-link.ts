/** Client-safe parts of the stream channels (`./channels` is server code). */

export interface StreamChannel {
  id: string;
  name: string;
  club_id: string | null;
  owner_id: string | null;
  match_id: string | null;
}

/** The channel's fixed overlay link (an OBS browser source). */
export function channelPath(channelId: string): string {
  return `/overlay/channel/${channelId}`;
}
