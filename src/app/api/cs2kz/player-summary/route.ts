import { sanitizeSteamId } from "@/lib/format";
import { KzPlayer, KzSteamProfile } from "@/lib/types";

const API_BASE_URL = "https://api.cs2kz.org";
const CACHE_SECONDS = 5 * 60;

function isSteamId(value: string): boolean {
  return /^STEAM_[0-5]:[01]:\d+$/i.test(value) || /^\d{10,20}$/.test(value);
}

async function getOptional<T>(path: string): Promise<T | null> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: CACHE_SECONDS },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`CS2KZ request failed (${response.status}) for ${path}`);
  return response.json() as Promise<T>;
}

export async function GET(request: Request) {
  const steamId = sanitizeSteamId(new URL(request.url).searchParams.get("steamId") ?? "");
  if (!isSteamId(steamId)) {
    return Response.json({ error: "Invalid Steam ID" }, { status: 400 });
  }

  try {
    const encodedId = encodeURIComponent(steamId);
    const [player, steamProfile] = await Promise.all([
      getOptional<KzPlayer>(`/players/${encodedId}`),
      getOptional<KzSteamProfile>(`/players/${encodedId}/steam-profile`),
    ]);

    return Response.json(
      { player, steamProfile },
      { headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600` } }
    );
  } catch (error) {
    console.error(`Failed to load player summary for ${steamId}:`, error);
    return Response.json(
      { error: "Player summary is temporarily unavailable" },
      { status: 502, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
