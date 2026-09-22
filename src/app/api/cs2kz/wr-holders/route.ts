import { sanitizeSteamId } from "@/lib/format";
import { KzRecord, Mode, Page } from "@/lib/types";

const API_BASE_URL = "https://api.cs2kz.org";
const CACHE_SECONDS = 5 * 60;
const PAGE_SIZE = 10;

interface TopWrPlayer {
  id: string;
  name: string;
  count: number;
}

function parseMode(value: string | null): Mode {
  return value === "vanilla" ? "vanilla" : "classic";
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const mode = parseMode(searchParams.get("mode"));
  const rankedOnly = searchParams.get("rankedOnly") !== "false";
  const requestedOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(requestedOffset) ? Math.max(0, requestedOffset) : 0;

  const upstreamParams = new URLSearchParams({
    mode,
    top: "true",
    max_rank: "1",
    limit: "1000",
    offset: "0",
  });
  if (rankedOnly) upstreamParams.set("ranked", "true");

  try {
    const response = await fetch(`${API_BASE_URL}/records?${upstreamParams.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`CS2KZ request failed (${response.status})`);

    const page = (await response.json()) as Page<KzRecord>;
    const counts = new Map<string, TopWrPlayer>();
    for (const record of page.values ?? []) {
      if (!record.player?.id) continue;
      const id = sanitizeSteamId(record.player.id);
      const current = counts.get(id);
      if (current) current.count += 1;
      else counts.set(id, { id, name: record.player.name || id, count: 1 });
    }

    const holders = Array.from(counts.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

    return Response.json(
      { total: holders.length, values: holders.slice(offset, offset + PAGE_SIZE) },
      { headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600` } }
    );
  } catch (error) {
    console.error(`Failed to load ${mode} WR holders:`, error);
    return Response.json(
      { error: "World-record leaderboard is temporarily unavailable" },
      { status: 502, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
