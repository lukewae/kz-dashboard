"use client";

import { sanitizeSteamId } from "@/lib/format";
import { steam2ToSteam64 } from "@/lib/steamAuth";
import { KzPlayer, KzRecord, KzSteamProfile, Mode, Page } from "@/lib/types";

const API_BASE_URL = "https://api.cs2kz.org";
const SUMMARY_TTL_MS = 5 * 60 * 1000;
const RECORDS_TTL_MS = 10 * 60 * 1000;
const AVATAR_TTL_MS = 24 * 60 * 60 * 1000;
const RECENT_WORLD_RECORDS_TTL_MS = 5 * 60 * 1000;
const RECENT_WORLD_RECORDS_MAX_STALE_MS = 24 * 60 * 60 * 1000;

interface TimedValue<T> {
  value: T;
  expiresAt: number;
}

export interface PlayerSummary {
  player: KzPlayer | null;
  steamProfile: KzSteamProfile | null;
}

export interface TopWrPlayer {
  id: string;
  name: string;
  count: number;
}

const summaryCache = new Map<string, TimedValue<PlayerSummary>>();
const summaryRequests = new Map<string, Promise<PlayerSummary>>();
const recordsCache = new Map<string, TimedValue<KzRecord[]>>();
const recordsRequests = new Map<string, Promise<KzRecord[]>>();
const worldRecordsCache = new Map<string, TimedValue<KzRecord[]>>();
const worldRecordsRequests = new Map<string, Promise<KzRecord[]>>();
const leaderboardPlayersCache = new Map<string, TimedValue<Page<KzPlayer>>>();
const leaderboardPlayersRequests = new Map<string, Promise<Page<KzPlayer>>>();
const wrHoldersPageCache = new Map<string, TimedValue<Page<TopWrPlayer>>>();
const wrHoldersPageRequests = new Map<string, Promise<Page<TopWrPlayer>>>();
const avatarCache = new Map<string, TimedValue<string>>();

interface StoredRecentWorldRecords {
  savedAt: number;
  records: KzRecord[];
}

interface StoredPlayerRecords {
  savedAt: number;
  records: KzRecord[];
}

function getFresh<T>(cache: Map<string, TimedValue<T>>, key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.value;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`CS2KZ request failed (${response.status}) for ${path}`);
  }

  return response.json() as Promise<T>;
}

export function getPlayerSummaryDirect(steamId: string): Promise<PlayerSummary> {
  const cleanId = sanitizeSteamId(steamId);
  const cached = getFresh(summaryCache, cleanId);
  if (cached) return Promise.resolve(cached);

  const pending = summaryRequests.get(cleanId);
  if (pending) return pending;

  const params = new URLSearchParams({ steamId: cleanId });
  const request = fetch(`/api/cs2kz/player-summary?${params.toString()}`, {
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Player summary request failed (${response.status})`);
      return response.json() as Promise<PlayerSummary>;
    })
    .then((value) => {
      const { player, steamProfile } = value;
      if (player || steamProfile) {
        summaryCache.set(cleanId, { value, expiresAt: Date.now() + SUMMARY_TTL_MS });
      }
      return value;
    })
    .finally(() => summaryRequests.delete(cleanId));

  summaryRequests.set(cleanId, request);
  return request;
}

export function getPlayerRecordsDirect(steamId: string, mode: Mode): Promise<KzRecord[]> {
  const cleanId = sanitizeSteamId(steamId);
  const key = `${cleanId}:${mode}`;
  const cached = getFresh(recordsCache, key);
  if (cached) return Promise.resolve(cached);

  try {
    const raw = sessionStorage.getItem(`player-records:${key}`);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<StoredPlayerRecords>;
      if (
        typeof stored.savedAt === "number" &&
        Date.now() - stored.savedAt <= RECORDS_TTL_MS &&
        Array.isArray(stored.records)
      ) {
        recordsCache.set(key, {
          value: stored.records,
          expiresAt: stored.savedAt + RECORDS_TTL_MS,
        });
        return Promise.resolve(stored.records);
      }
      sessionStorage.removeItem(`player-records:${key}`);
    }
  } catch {
    // Session storage is optional; shared server caching still applies.
  }

  const pending = recordsRequests.get(key);
  if (pending) return pending;

  const params = new URLSearchParams({ steamId: cleanId, mode });
  const request = fetch(`/api/cs2kz/player-records?${params.toString()}`, {
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Player records request failed (${response.status})`);
      return response.json() as Promise<{ records?: KzRecord[] }>;
    })
    .then((result) => {
      const records = Array.isArray(result.records) ? result.records : [];
      recordsCache.set(key, { value: records, expiresAt: Date.now() + RECORDS_TTL_MS });
      try {
        sessionStorage.setItem(
          `player-records:${key}`,
          JSON.stringify({ savedAt: Date.now(), records } satisfies StoredPlayerRecords)
        );
      } catch {
        // Large profiles or private browsing can reject storage writes.
      }
      return records;
    })
    .finally(() => recordsRequests.delete(key));

  recordsRequests.set(key, request);
  return request;
}

export function getRecentWorldRecordsDirect(mode: Mode, limit = 5): Promise<KzRecord[]> {
  const key = `${mode}:${limit}`;
  const cached = getFresh(worldRecordsCache, key);
  if (cached) return Promise.resolve(cached);

  const pending = worldRecordsRequests.get(key);
  if (pending) return pending;

  const params = new URLSearchParams({ mode });
  const request = fetch(`/api/cs2kz/recent-world-records?${params.toString()}`, {
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Recent world records request failed (${response.status})`);
      return response.json() as Promise<{ records?: KzRecord[] }>;
    })
    .then((result) => {
      const records = Array.isArray(result.records) ? result.records.slice(0, limit) : [];
      worldRecordsCache.set(key, {
        value: records,
        expiresAt: Date.now() + RECENT_WORLD_RECORDS_TTL_MS,
      });
      try {
        localStorage.setItem(
          `recent-world-records:${key}`,
          JSON.stringify({ savedAt: Date.now(), records } satisfies StoredRecentWorldRecords)
        );
      } catch {
        // Storage may be unavailable in private browsing; the memory cache still works.
      }
      return records;
    })
    .finally(() => worldRecordsRequests.delete(key));

  worldRecordsRequests.set(key, request);
  return request;
}

export function getCachedRecentWorldRecords(mode: Mode, limit = 5): KzRecord[] {
  const key = `${mode}:${limit}`;
  const memoryCached = getFresh(worldRecordsCache, key);
  if (memoryCached) return memoryCached;

  try {
    const raw = localStorage.getItem(`recent-world-records:${key}`);
    if (!raw) return [];
    const stored = JSON.parse(raw) as Partial<StoredRecentWorldRecords>;
    if (
      typeof stored.savedAt !== "number" ||
      Date.now() - stored.savedAt > RECENT_WORLD_RECORDS_MAX_STALE_MS ||
      !Array.isArray(stored.records)
    ) {
      localStorage.removeItem(`recent-world-records:${key}`);
      return [];
    }
    return stored.records.slice(0, limit);
  } catch {
    return [];
  }
}

export function getLeaderboardPlayersPageDirect(mode: Mode, offset: number, limit = 10): Promise<Page<KzPlayer>> {
  const key = `${mode}:${offset}:${limit}`;
  const cached = getFresh(leaderboardPlayersCache, key);
  if (cached) return Promise.resolve(cached);

  const pending = leaderboardPlayersRequests.get(key);
  if (pending) return pending;

  const params = new URLSearchParams({
    sort_by: mode === "classic" ? "ckz-rating" : "vnl-rating",
    limit: String(limit),
    offset: String(offset),
  });
  const request = fetchJson<Page<KzPlayer>>(`/players?${params.toString()}`)
    .then((result) => {
      leaderboardPlayersCache.set(key, { value: result, expiresAt: Date.now() + 30_000 });
      return result;
    })
    .finally(() => leaderboardPlayersRequests.delete(key));

  leaderboardPlayersRequests.set(key, request);
  return request;
}

export function getWrHoldersPageDirect(
  mode: Mode,
  offset: number,
  rankedOnly = true
): Promise<Page<TopWrPlayer>> {
  const key = `${mode}:${offset}:${rankedOnly}`;
  const cached = getFresh(wrHoldersPageCache, key);
  if (cached) return Promise.resolve(cached);

  const pending = wrHoldersPageRequests.get(key);
  if (pending) return pending;

  const params = new URLSearchParams({
    mode,
    offset: String(offset),
    rankedOnly: String(rankedOnly),
  });
  const request = fetch(`/api/cs2kz/wr-holders?${params.toString()}`, {
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`WR holders request failed (${response.status})`);
      return response.json() as Promise<Page<TopWrPlayer>>;
    })
    .then((result) => {
      wrHoldersPageCache.set(key, {
        value: result,
        expiresAt: Date.now() + RECENT_WORLD_RECORDS_TTL_MS,
      });
      return result;
    })
    .finally(() => wrHoldersPageRequests.delete(key));

  wrHoldersPageRequests.set(key, request);
  return request;
}

export async function getSteamAvatarsDirect(
  steamIds: string[],
  onBatch?: (avatars: Record<string, string>) => void
): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set(steamIds.map(sanitizeSteamId).filter(Boolean)));
  const result: Record<string, string> = {};
  const unresolved: string[] = [];

  for (const id of uniqueIds) {
    const cached = getFresh(avatarCache, id);
    if (cached) result[id] = cached;
    else unresolved.push(id);
  }

  if (unresolved.length > 0) {
    const query = unresolved.map(encodeURIComponent).join(",");
    const response = await fetch(`/api/steam/avatars?ids=${query}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (response.ok) {
      const data = (await response.json()) as { avatars?: Record<string, string> };
      for (const id of unresolved) {
        const avatar = data.avatars?.[steam2ToSteam64(id)] || data.avatars?.[id];
        if (!avatar) continue;
        result[id] = avatar;
        avatarCache.set(id, { value: avatar, expiresAt: Date.now() + AVATAR_TTL_MS });
      }
    }
  }

  if (Object.keys(result).length > 0) onBatch?.(result);
  return result;
}
