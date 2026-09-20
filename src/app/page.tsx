import { Metadata } from "next";
import { cs2kzProvider } from "@/lib/providers/cs2kz";
import { Mode } from "@/lib/types";
import { OverviewDashboard } from "@/components/OverviewDashboard";

export const metadata: Metadata = {
  title: "Overview - CS2KZ Dashboard",
  description: "Live Counter-Strike 2 KZ telemetry, recent world records, and global rating leaderboards.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    mode?: string;
  }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const mode: Mode = params.mode === "vanilla" ? "vanilla" : "classic";

  const [allMaps, topPlayersData, allServers] = await Promise.all([
    cs2kzProvider.getAllMaps(),
    cs2kzProvider.getTopPlayers({ mode, limit: 20, fresh: false, revalidate: 30, timeoutMs: 4000 }),
    cs2kzProvider.getServers({ fresh: false, revalidate: 10, timeoutMs: 3000 }),
  ]);

  return (
    <OverviewDashboard
      mode={mode}
      recentWrs={[]}
      topPointsPlayers={topPlayersData.values}
      allMaps={allMaps}
      allServers={allServers}
    />
  );
}
