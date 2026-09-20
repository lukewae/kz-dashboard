import { Metadata } from "next";
import { Mode } from "@/lib/types";
import { LeaderboardsBrowser } from "@/components/LeaderboardsBrowser";

export const metadata: Metadata = {
  title: "Leaderboards - CS2KZ Dashboard",
  description: "Global player ratings and world record leaderboards for CS2KZ Classic and Vanilla modes.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    mode?: string;
  }>;
}

export default async function LeaderboardsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const mode: Mode = params.mode === "vanilla" ? "vanilla" : "classic";

  return (
    <>
      <div className="page-eyebrow">CS2KZ // GLOBAL LEADERBOARDS</div>
      <h1 className="page-title">Leaderboards</h1>

      <LeaderboardsBrowser
        mode={mode}
      />
    </>
  );
}
