import { NextRequest, NextResponse } from "next/server";
import { cs2kzProvider } from "@/lib/providers/cs2kz";
import { sanitizeSteamId } from "@/lib/format";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSteamId = searchParams.get("steamId");

  if (!rawSteamId) {
    return NextResponse.json({ error: "Missing steamId" }, { status: 400 });
  }

  const cleanId = sanitizeSteamId(rawSteamId);
  try {
    const [player, steamProfile] = await Promise.all([
      cs2kzProvider.getPlayer(cleanId),
      cs2kzProvider.getPlayerSteamProfile(cleanId),
    ]);

    return NextResponse.json({
      player,
      steamProfile,
    });
  } catch (err) {
    console.error("Failed to fetch player summary:", err);
    return NextResponse.json({ error: "Failed to fetch player summary" }, { status: 500 });
  }
}
