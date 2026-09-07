import { steam2ToSteam64 } from "@/lib/steamAuth";

const MAX_IDS = 100;
const ONE_DAY_SECONDS = 60 * 60 * 24;
const avatarCache = new Map<string, { avatar: string; expiresAt: number }>();

type SteamSummary = {
  steamid?: string;
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
};

function normalizeIds(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((id) => steam2ToSteam64(id.trim()))
        .filter((id) => /^\d{10,20}$/.test(id))
    )
  ).slice(0, MAX_IDS);
}

export async function GET(request: Request) {
  const apiKey = process.env.STEAM_WEB_API_KEY;
  const ids = normalizeIds(new URL(request.url).searchParams.get("ids") ?? "");

  if (ids.length === 0) {
    return Response.json({ avatars: {} }, { headers: { "Cache-Control": "public, max-age=300" } });
  }
  if (!apiKey) {
    return Response.json({ error: "Steam avatar service is not configured" }, { status: 503 });
  }

  const avatars: Record<string, string> = {};
  const missing: string[] = [];
  const now = Date.now();
  for (const id of ids) {
    const cached = avatarCache.get(id);
    if (cached && cached.expiresAt > now) avatars[id] = cached.avatar;
    else missing.push(id);
  }

  if (missing.length > 0) {
    const params = new URLSearchParams({ key: apiKey, steamids: missing.join(","), format: "json" });
    const response = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?${params.toString()}`,
      { signal: AbortSignal.timeout(10000), next: { revalidate: ONE_DAY_SECONDS } }
    );
    if (!response.ok) {
      return Response.json({ avatars }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
    }

    const data = (await response.json()) as { response?: { players?: SteamSummary[] } };
    for (const player of data.response?.players ?? []) {
      if (!player.steamid) continue;
      const avatar = player.avatarfull || player.avatarmedium || player.avatar;
      if (!avatar) continue;
      avatars[player.steamid] = avatar;
      avatarCache.set(player.steamid, { avatar, expiresAt: now + ONE_DAY_SECONDS * 1000 });
    }
  }

  return Response.json(
    { avatars },
    { headers: { "Cache-Control": `public, s-maxage=${ONE_DAY_SECONDS}, stale-while-revalidate=3600` } }
  );
}
