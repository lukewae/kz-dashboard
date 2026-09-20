"use client";

import { sanitizeSteamId } from "@/lib/format";
import { steam2ToSteam64 } from "@/lib/steamAuth";
import { KzPlayer, KzRecord, KzSteamProfile, Mode, Page } from "@/lib/types";

const API_BASE_URL = "https://api.cs2kz.org";
const SUMMARY_TTL_MS = 5 * 60 * 1000;
const RECORDS_TTL_MS = 2 * 60 * 1000;
const AVATAR_TTL_MS = 24 * 60 * 60 * 1000;
const RANKS_TTL_MS = 5 * 60 * 1000;

interface TimedValue<T> {
  value: T;
  expiresAt: number;
}

export interface PlayerSummary {
  player: KzPlayer | null;
  steamProfile: KzSteamProfile | null;
}

export interface ProfileRanks {
  overallRank: number | null;
  wrLeaderboardRank: number | null;
}

const summaryCache = new Map<string, TimedValue<PlayerSummary>>();
const summaryRequests = new Map<string, Promise<PlayerSummary>>();
const recordsCache = new Map<string, TimedValue<KzRecord[]>>();
const recordsRequests = new Map<string, Promise<KzRecord[]>>();
const worldRecordsCache = new Map<string, TimedValue<KzRecord[]>>();
const worldRecordsRequests = new Map<string, Promise<KzRecord[]>>();
const leaderboardPlayersCache = new Map<string, TimedValue<Page<KzPlayer>>>();
const leaderboardPlayersRequests = new Map<string, Promise<Page<KzPlayer>>>();
const worldRecordsPageCache = new Map<string, TimedValue<Page<KzRecord>>>();
const worldRecordsPageRequests = new Map<string, Promise<Page<KzRecord>>>();
const steamProfileCache = new Map<string, TimedValue<KzSteamProfile>>();
const steamProfileRequests = new Map<string, Promise<KzSteamProfile | null>>();
const avatarCache = new Map<string, TimedValue<string>>();
const profileRanksCache = new Map<string, TimedValue<ProfileRanks>>();
const profileRanksRequests = new Map<string, Promise<ProfileRanks>>();

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

function getSteamProfileDirect(steamId: string): Promise<KzSteamProfile | null> {
  const cleanId = sanitizeSteamId(steamId);
  const cached = getFresh(steamProfileCache, cleanId);
  if (cached) return Promise.resolve(cached);

  const pending = steamProfileRequests.get(cleanId);
  if (pending) return pending;

  const request = fetchJson<KzSteamProfile>(
    `/players/${encodeURIComponent(cleanId)}/steam-profile`
  )
    .then((profile) => {
      steamProfileCache.set(cleanId, {
        value: profile,
        expiresAt: Date.now() + AVATAR_TTL_MS,
      });
      return profile;
    })
    .catch(() => null)
    .finally(() => steamProfileRequests.delete(cleanId));

  steamProfileRequests.set(cleanId, request);
  return request;
}

export function getPlayerSummaryDirect(steamId: string): Promise<PlayerSummary> {
  const cleanId = sanitizeSteamId(steamId);
  const cached = getFresh(summaryCache, cleanId);
  if (cached) return Promise.resolve(cached);

  const pending = summaryRequests.get(cleanId);
  if (pending) return pending;

  const request = Promise.all([
    fetchJson<KzPlayer>(`/players/${encodeURIComponent(cleanId)}`).catch(() => null),
    getSteamProfileDirect(cleanId),
  ])
    .then(([player, steamProfile]) => {
      const value = { player, steamProfile };
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

  const pending = recordsRequests.get(key);
  if (pending) return pending;

  const params = new URLSearchParams({
    player: cleanId,
    mode,
    top: "true",
    limit: "1000",
    offset: "0",
  });

  const request = fetchJson<Page<KzRecord>>(`/records?${params.toString()}`)
    .then((page) => {
      const records = Array.isArray(page.values) ? page.values : [];
      recordsCache.set(key, { value: records, expiresAt: Date.now() + RECORDS_TTL_MS });
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

  const params = new URLSearchParams({
    mode,
    top: "true",
    max_rank: "1",
    limit: String(limit),
    offset: "0",
  });

  const request = fetchJson<Page<KzRecord>>(`/records?${params.toString()}`)
    .then((page) => {
      const records = Array.isArray(page.values) ? page.values : [];
      worldRecordsCache.set(key, { value: records, expiresAt: Date.now() + 30_000 });
      return records;
    })
    .catch(() => [])
    .finally(() => worldRecordsRequests.delete(key));

  worldRecordsRequests.set(key, request);
  return request;
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

export function getWorldRecordsPageDirect(
  mode: Mode,
  offset: number,
  limit = 10,
  rankedOnly = true
): Promise<Page<KzRecord>> {
  const key = `${mode}:${offset}:${limit}:${rankedOnly}`;
  const cached = getFresh(worldRecordsPageCache, key);
  if (cached) return Promise.resolve(cached);

  const pending = worldRecordsPageRequests.get(key);
  if (pending) return pending;

  const params = new URLSearchParams({
    mode,
    top: "true",
    max_rank: "1",
    limit: String(limit),
    offset: String(offset),
  });
  if (rankedOnly) params.set("ranked", "true");

  const request = fetchJson<Page<KzRecord>>(`/records?${params.toString()}`)
    .then((result) => {
      worldRecordsPageCache.set(key, { value: result, expiresAt: Date.now() + 30_000 });
      return result;
    })
    .finally(() => worldRecordsPageRequests.delete(key));

  worldRecordsPageRequests.set(key, request);
  return request;
}

export function getProfileRanksDirect(steamId: string, mode: Mode): Promise<ProfileRanks> {
  const cleanId = sanitizeSteamId(steamId);
  const key = `${cleanId}:${mode}`;
  const cached = getFresh(profileRanksCache, key);
  if (cached) return Promise.resolve(cached);

  const pending = profileRanksRequests.get(key);
  if (pending) return pending;

  const playersQuery = new URLSearchParams({
    sort_by: mode === "classic" ? "ckz-rating" : "vnl-rating",
    limit: "1000",
    offset: "0",
  });
  const recordsQuery = new URLSearchParams({
    mode,
    top: "true",
    max_rank: "1",
    limit: "1000",
    offset: "0",
  });

  const request = Promise.all([
    fetchJson<Page<KzPlayer>>(`/players?${playersQuery.toString()}`).catch(() => ({ total: 0, values: [] })),
    fetchJson<Page<KzRecord>>(`/records?${recordsQuery.toString()}`).catch(() => ({ total: 0, values: [] })),
  ])
    .then(([players, worldRecords]) => {
      const overallIndex = players.values.findIndex((player) => sanitizeSteamId(player.id) === cleanId);
      const wrCounts = new Map<string, number>();
      for (const record of worldRecords.values) {
        if (!record.player?.id) continue;
        const playerId = sanitizeSteamId(record.player.id);
        wrCounts.set(playerId, (wrCounts.get(playerId) ?? 0) + 1);
      }
      const wrIndex = Array.from(wrCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .findIndex(([playerId]) => playerId === cleanId);
      const value = {
        overallRank: overallIndex >= 0 ? overallIndex + 1 : null,
        wrLeaderboardRank: wrIndex >= 0 ? wrIndex + 1 : null,
      };
      profileRanksCache.set(key, { value, expiresAt: Date.now() + RANKS_TTL_MS });
      return value;
    })
    .finally(() => profileRanksRequests.delete(key));

  profileRanksRequests.set(key, request);
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
