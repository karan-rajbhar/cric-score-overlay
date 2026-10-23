import { OverlayGallery } from "~/components/overlay/packages/gallery";

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? null;

export default async function OverlayGalleryPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const p = await searchParams;
  return (
    <OverlayGallery
      packageId={one(p.package) ?? "standard"}
      element={one(p.element)}
      state={one(p.state)}
      variant={one(p.variant)}
      kind={one(p.kind)}
      bg={one(p.bg)}
    />
  );
}
