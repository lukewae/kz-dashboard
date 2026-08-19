import { Shell } from "@/components/Shell";
import { MapsBrowser } from "@/components/MapsBrowser";
import { cs2kzProvider } from "@/lib/providers/cs2kz";

export const revalidate = 60;

export default async function MapsPage() {
  const maps = await cs2kzProvider.getAllMaps();

  return (
    <Shell>
      <div className="page-eyebrow">CS2KZ DATABASE // BROWSE</div>
      <h1 className="page-title">Maps Directory</h1>

      <MapsBrowser maps={maps} />
    </Shell>
  );
}
