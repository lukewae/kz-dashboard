import { sanitizeSteamId } from "@/lib/format";
import { KzRecord, Mode, Page } from "@/lib/types";

const API_BASE_URL = "https://api.cs2kz.org";
const CACHE_SECONDS = 10 * 60;

function isSteamId(value: string): boolean {
  return /^STEAM_[0-5]:[01]:\d+$/i.test(value) || /^\d{10,20}$/.test(value);
}

function parseMode(value: string | null): Mode {
  return value === "vanilla" ? "vanilla" : "classic";
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const steamId = sanitizeSteamId(searchParams.get("steamId") ?? "");
  const mode = parseMode(searchParams.get("mode"));
  if (!isSteamId(steamId)) {
    return Response.json({ error: "Invalid Steam ID" }, { status: 400 });
  }

  const upstreamParams = new URLSearchParams({
    player: steamId,
    mode,
    top: "true",
    limit: "1000",
    offset: "0",
  });

  try {
    const response = await fetch(`${API_BASE_URL}/records?${upstreamParams.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`CS2KZ request failed (${response.status})`);

    const page = (await response.json()) as Page<KzRecord>;
    const records = Array.isArray(page.values) ? page.values : [];
    return Response.json(
      { records },
      { headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600` } }
    );
  } catch (error) {
    console.error(`Failed to load ${mode} records for ${steamId}:`, error);
    return Response.json(
      { error: "Player records are temporarily unavailable" },
      { status: 502, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
