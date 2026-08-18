import { NextRequest, NextResponse } from "next/server";
import { cs2kzProvider } from "@/lib/providers/cs2kz";
import { Leaderboard, Mode } from "@/lib/types";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const player = p.get("player");
  const map = p.get("map");
  const course = p.get("course");
  const modeParam = p.get("mode");
  const leaderboardParam = p.get("leaderboard");

  const mode: Mode = modeParam === "vanilla" ? "vanilla" : "classic";
  const leaderboard: Leaderboard = leaderboardParam === "pro" ? "pro" : "overall";

  try {
    // If player is specified, fetch that player's records
    if (player) {
      const records = await cs2kzProvider.getPlayerRecords(player, { mode, leaderboard });
      return NextResponse.json({
        total: records.total,
        records: records.values,
      });
    }

    // Otherwise, fetch map/course records
    if (map && course) {
      const records = await cs2kzProvider.getRecords({
        map,
        course,
        mode,
        leaderboard,
      });
      return NextResponse.json(records);
    }

    return NextResponse.json({ error: "Invalid records query" }, { status: 400 });
  } catch (err) {
    console.error("Failed to fetch records:", err);
    return NextResponse.json({ error: "CS2KZ API unavailable" }, { status: 502 });
  }
}
