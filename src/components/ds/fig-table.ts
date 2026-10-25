/*
 * Figure tables: the first column is a name, the rest are right-aligned
 * tabular figures. Runs and wickets carry the weight; the rest stay plain.
 *
 * These are class strings, so they live outside `scorecard.tsx` ("use
 * client"): a server component importing a constant from a client module
 * gets a client reference, not the string, and its table loses its classes.
 */

export const figTable = "w-full text-sm tabular-nums";
// The name column takes the slack (first:w-full), so figures stay compact
// on the right and long names keep their room on phones.
export const figHead =
  "px-2 py-2 text-right text-xs font-medium text-muted-foreground first:w-full first:pl-4 first:text-left last:pr-4 sm:px-3 sm:first:pl-4 sm:last:pr-4";
export const figCell =
  "px-2 py-2.5 text-right font-score first:pl-4 first:text-left last:pr-4 sm:px-3 sm:first:pl-4 sm:last:pr-4";
