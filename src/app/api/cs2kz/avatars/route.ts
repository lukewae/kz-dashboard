import { NextRequest, NextResponse } from "next/server";
import { cs2kzProvider } from "@/lib/providers/cs2kz";
import { sanitizeSteamId } from "@/lib/format";

// Global memory cache for resolved player avatars
const avatarCache = new Map<string, string | null>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const steamidsParam =
    searchParams.get("steamids") ||
    searchParams.get("ids") ||
    searchParams.get("steamId");

  if (!steamidsParam) {
    return NextResponse.json({});
  }

  const rawIds = steamidsParam.split(",").map((s) => s.trim()).filter(Boolean);
  const uniqueIds = Array.from(new Set(rawIds)).map(sanitizeSteamId);

  const missingIds = uniqueIds.filter((id) => !avatarCache.has(id));

  if (missingIds.length > 0) {
    // Fetch missing avatars in parallel
    const fetchPromises = missingIds.slice(0, 100).map(async (sid) => {
      try {
        const profile = await cs2kzProvider.getPlayerSteamProfile(sid);
        avatarCache.set(sid, profile?.avatar_url || null);
      } catch {
        avatarCache.set(sid, null);
      }
    });

    await Promise.all(fetchPromises);
  }

  const result: Record<string, string | null> = {};
  uniqueIds.forEach((id) => {
    result[id] = avatarCache.get(id) || null;
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
