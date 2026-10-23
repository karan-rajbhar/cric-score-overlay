// TEMPORARY (not committed).
import { Scratch } from "./scratch";

type Params = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return <Scratch c={one(p.c)} element={one(p.element)} k={one(p.k)} />;
}
