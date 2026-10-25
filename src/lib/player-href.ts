/** A player's profile page. */
export const playerHref = (userId: string) => `/players/${userId}`;

/** The profile page of a row that may not know its player (none: no link). */
export const playerHrefOf = (userId: string | null | undefined) =>
  userId ? playerHref(userId) : undefined;
