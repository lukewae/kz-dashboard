import { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { cs2kzProvider } from "@/lib/providers/cs2kz";
import { Mode } from "@/lib/types";
import { LeaderboardsBrowser } from "@/components/LeaderboardsBrowser";

export const metadata: Metadata = {
  title: "Leaderboards - CS2KZ Dashboard",
  description: "Global player ratings and world record leaderboards for CS2KZ Classic and Vanilla modes.",
};

export const revalidate = 60;

interface PageProps {
  searchParams: Promise<{
    mode?: string;
  }>;
}

export default async function LeaderboardsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const mode: Mode = params.mode === "vanilla" ? "vanilla" : "classic";

  const [allMaps, worldRecords, topPlayersData] = await Promise.all([
    cs2kzProvider.getAllMaps(),
    cs2kzProvider.getWorldRecords({ mode }),
    cs2kzProvider.getTopPlayers({ mode, limit: 100 }),
  ]);

  return (
    <Shell>
      <div className="page-eyebrow">CS2KZ // GLOBAL LEADERBOARDS</div>
      <h1 className="page-title">Leaderboards</h1>

      <LeaderboardsBrowser
        topPlayers={topPlayersData.values}
        worldRecords={worldRecords}
        allMaps={allMaps}
        mode={mode}
      />
    </Shell>
  );
}
