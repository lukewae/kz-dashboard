import { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { cs2kzProvider } from "@/lib/providers/cs2kz";
import { Mode } from "@/lib/types";
import { OverviewDashboard } from "@/components/OverviewDashboard";

export const metadata: Metadata = {
  title: "Overview - CS2KZ Dashboard",
  description: "Live Counter-Strike 2 KZ telemetry, recent world records, and global rating leaderboards.",
};

export const revalidate = 30;

interface PageProps {
  searchParams: Promise<{
    mode?: string;
  }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const mode: Mode = params.mode === "vanilla" ? "vanilla" : "classic";

  const [allMaps, allWorldRecords, topPlayersData, allServers] = await Promise.all([
    cs2kzProvider.getAllMaps(),
    cs2kzProvider.getWorldRecords({ mode }),
    cs2kzProvider.getTopPlayers({ mode, limit: 20 }),
    cs2kzProvider.getServers(),
  ]);

  return (
    <Shell>
      <OverviewDashboard
        mode={mode}
        recentWrs={allWorldRecords}
        topPointsPlayers={topPlayersData.values}
        allWorldRecords={allWorldRecords}
        allMaps={allMaps}
        allServers={allServers}
      />
    </Shell>
  );
}
