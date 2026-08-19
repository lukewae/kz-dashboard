import { KzDataProvider, KzMap, KzPlayer, KzRecord, KzServer, KzSteamProfile, Mode, Page, RecordsQuery } from "@/lib/types";
import { sanitizeSteamId } from "@/lib/format";

const base = process.env.CS2KZ_API_BASE_URL || "https://api.cs2kz.org";

// Memory cache for workshop image URLs
const workshopImageCache = new Map<number, string>();

async function request<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${cleanBase}${cleanPath}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const signal = AbortSignal.timeout(12000);
  const response = await fetch(url.toString(), {
    next: { revalidate: 60 },
    signal,
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  });

  if (!response.ok) {
    throw new Error(`CS2KZ API request failed (${response.status}) for ${cleanPath}`);
  }
  return response.json() as Promise<T>;
}

function page<T>(raw: unknown): Page<T> {
  if (!raw || typeof raw !== "object") {
    throw new Error("Malformed CS2KZ response");
  }
  const item = raw as { total?: unknown; values?: unknown };
  return {
    total: typeof item.total === "number" ? item.total : 0,
    values: Array.isArray(item.values) ? (item.values as T[]) : [],
  };
}

function validMap(value: unknown): value is KzMap {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { name?: unknown }).name === "string" &&
    Array.isArray((value as { courses?: unknown }).courses)
  );
}

/**
 * Resolves high-resolution workshop thumbnail URLs directly from Steam's CDN
 */
async function attachSteamImages(maps: KzMap[]): Promise<KzMap[]> {
  const uncachedIds: number[] = [];
  maps.forEach((m) => {
    if (m.workshop_id && !workshopImageCache.has(m.workshop_id)) {
      uncachedIds.push(m.workshop_id);
    }
  });

  if (uncachedIds.length > 0) {
    try {
      const postParams = new URLSearchParams();
      postParams.set("itemcount", String(uncachedIds.length));
      uncachedIds.forEach((id, idx) => {
        postParams.set(`publishedfileids[${idx}]`, String(id));
      });

      const res = await fetch(
        "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/",
        {
          method: "POST",
          body: postParams,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          next: { revalidate: 3600 },
        }
      );

      if (res.ok) {
        const data = await res.json();
        const details = data?.response?.publishedfiledetails;
        if (Array.isArray(details)) {
          details.forEach((item: { publishedfileid?: string; preview_url?: string }) => {
            if (item.publishedfileid && item.preview_url) {
              const idNum = parseInt(item.publishedfileid, 10);
              if (!Number.isNaN(idNum)) {
                workshopImageCache.set(idNum, item.preview_url);
              }
            }
          });
        }
      }
    } catch (err) {
      console.warn("Failed to fetch Steam Workshop images:", err);
    }
  }

  // Attach resolved image URLs
  return maps.map((m) => ({
    ...m,
    image_url:
      (m.workshop_id ? workshopImageCache.get(m.workshop_id) : null) ||
      `https://github.com/kzglobalteam/cs2kz-images/raw/public/webp/medium/${encodeURIComponent(m.name)}/1.webp`,
  }));
}

export const cs2kzProvider: KzDataProvider = {
  game: "cs2",

  async getAllMaps(): Promise<KzMap[]> {
    try {
      const data = page<unknown>(
        await request<unknown>("/maps", {
          limit: 100,
          offset: 0,
        })
      );
      const valid = data.values
        .filter(validMap)
        .filter((m) => m.state?.toLowerCase() !== "invalid");
      return await attachSteamImages(valid);
    } catch (err) {
      console.error("Failed to fetch maps from CS2KZ API:", err);
      return [];
    }
  },

  async searchMaps(query: string): Promise<KzMap[]> {
    try {
      const trimmed = query.trim();
      const data = page<unknown>(
        await request<unknown>("/maps", {
          name: trimmed || undefined,
          limit: 100,
          offset: 0,
        })
      );
      const valid = data.values
        .filter(validMap)
        .filter((m) => m.state?.toLowerCase() !== "invalid");
      return await attachSteamImages(valid);
    } catch (err) {
      console.error("Failed to search maps from CS2KZ API:", err);
      return [];
    }
  },

  async getMap(name: string): Promise<KzMap | null> {
    try {
      const cleanName = decodeURIComponent(name).trim();
      const maps = await this.searchMaps(cleanName);
      const exact = maps.find((m) => m.name.toLowerCase() === cleanName.toLowerCase());
      if (exact) return exact;

      const all = await this.getAllMaps();
      return all.find((m) => m.name.toLowerCase() === cleanName.toLowerCase()) ?? null;
    } catch (err) {
      console.error(`Failed to get map "${name}" from CS2KZ API:`, err);
      return null;
    }
  },

  async getRecords(query: RecordsQuery): Promise<Page<KzRecord>> {
    const hasTeleports = query.leaderboard === "pro" ? false : undefined;
    try {
      return page<KzRecord>(
        await request<unknown>("/records", {
          map: query.map,
          course: query.course,
          player: query.player ? decodeURIComponent(query.player) : undefined,
          mode: query.mode,
          top: true,
          sort_by: "time",
          sort_order: "ascending",
          limit: query.limit ?? 100,
          offset: query.offset ?? 0,
          has_teleports: hasTeleports,
        })
      );
    } catch (err) {
      console.error(`Failed to get records:`, err);
      return { total: 0, values: [] };
    }
  },

  async getPlayer(steamId: string): Promise<KzPlayer | null> {
    try {
      const cleanId = sanitizeSteamId(steamId);
      return await request<KzPlayer>(`/players/${cleanId}`);
    } catch (err) {
      console.error(`Failed to get player info for ${steamId}:`, err);
      return null;
    }
  },

  async getPlayerSteamProfile(steamId: string): Promise<KzSteamProfile | null> {
    try {
      const cleanId = sanitizeSteamId(steamId);
      return await request<KzSteamProfile>(`/players/${cleanId}/steam-profile`);
    } catch (err) {
      console.error(`Failed to get steam profile for ${steamId}:`, err);
      return null;
    }
  },

  async getPlayerRecords(
    steamId: string,
    options: { mode?: "vanilla" | "classic"; leaderboard?: "overall" | "pro" } = {}
  ): Promise<Page<KzRecord>> {
    const cleanId = sanitizeSteamId(steamId);
    const mode = options.mode || "classic";
    const hasTeleports = options.leaderboard === "pro" ? false : undefined;
    try {
      return page<KzRecord>(
        await request<unknown>("/records", {
          player: cleanId,
          mode,
          has_teleports: hasTeleports,
          top: true,
          limit: 1000,
          offset: 0,
        })
      );
    } catch (err) {
      console.error(`Failed to get player records for ${cleanId}:`, err);
      return { total: 0, values: [] };
    }
  },

  async getWorldRecords(options: { mode?: Mode; limit?: number } = {}): Promise<KzRecord[]> {
    const mode = options.mode || "classic";
    try {
      const data = page<KzRecord>(
        await request<unknown>("/records", {
          mode,
          top: true,
          max_rank: 1,
          limit: options.limit ?? 1000,
          offset: 0,
        })
      );
      return data.values;
    } catch (err) {
      console.error("Failed to get world records:", err);
      return [];
    }
  },

  async getTopPlayers(options: { mode?: Mode; limit?: number; offset?: number } = {}): Promise<Page<KzPlayer>> {
    const mode = options.mode || "classic";
    const sortBy = mode === "classic" ? "ckz-rating" : "vnl-rating";
    try {
      return page<KzPlayer>(
        await request<unknown>("/players", {
          sort_by: sortBy,
          limit: options.limit ?? 100,
          offset: options.offset ?? 0,
        })
      );
    } catch (err) {
      console.error("Failed to get top players:", err);
      return { total: 0, values: [] };
    }
  },

  async getServers(): Promise<KzServer[]> {
    try {
      const data = page<KzServer>(
        await request<unknown>("/servers", {
          limit: 500,
          offset: 0,
        })
      );
      return data.values;
    } catch (err) {
      console.error("Failed to get global servers:", err);
      return [];
    }
  },

  async getServer(id: number | string): Promise<KzServer | null> {
    try {
      return await request<KzServer>(`/servers/${id}`);
    } catch (err) {
      console.error(`Failed to get server info for ${id}:`, err);
      return null;
    }
  },
};
