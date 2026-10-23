/**
 * The overlay's packages by theme id: names and descriptions only (pure,
 * so the server's overlay_state model can validate theme ids without
 * importing components). The components live in `registry.tsx`.
 *
 * Adding a package: an entry here and one in `registry.tsx`, with the
 * same id. Names describe the look ("Night stadium", "Bold stripes"):
 * no league, competition or broadcaster names, logos or marks.
 */

export interface PackageManifestEntry {
  id: string;
  label: string;
  description: string;
  /** Plain: the app's quiet look. Broadcast: TV-style motion and type. */
  kind: "plain" | "broadcast";
}

export const PACKAGE_MANIFEST: readonly PackageManifestEntry[] = [
  {
    id: "standard",
    label: "Standard",
    description: "Navy bar, white figures. Reads over grass and dark footage.",
    kind: "plain",
  },
  {
    id: "light",
    label: "Light",
    description: "White bar, navy figures. For night or dark footage.",
    kind: "plain",
  },
  {
    id: "team",
    label: "Team colours",
    description: "Each side in its team colour, Standard where a team has none.",
    kind: "plain",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Your primary and accent colours, text picked for contrast.",
    kind: "plain",
  },
  {
    id: "franchise-night",
    label: "Franchise night",
    description:
      "Glossy prime-time franchise-league look: dark glass lit in team colours, gold accents, big figures.",
    kind: "broadcast",
  },
  {
    id: "hundred-ball",
    label: "Hundred-ball countdown",
    description:
      "Bold, minimal ball-countdown look for short formats: giant runs and balls left, the chase in one line.",
    kind: "broadcast",
  },
  {
    id: "world-event",
    label: "World event",
    description:
      "Global tournament look with bold, clean data: white and deep indigo panels, each side in its team colour.",
    kind: "broadcast",
  },
];

/** Whether `id` names a package. */
export function isPackageId(id: string): boolean {
  return PACKAGE_MANIFEST.some((p) => p.id === id);
}
