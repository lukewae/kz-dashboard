"use client";

import { sanitizeSteamId } from "@/lib/format";
import { KzPlayer, KzRecord, KzSteamProfile, Mode, Page } from "@/lib/types";

const API_BASE_URL = "https://api.cs2kz.org";
const SUMMARY_TTL_MS = 5 * 60 * 1000;
const RECORDS_TTL_MS = 2 * 60 * 1000;
const AVATAR_TTL_MS = 24 * 60 * 60 * 1000;
const AVATAR_CONCURRENCY = 6;

interface TimedValue<T> {
  value: T;
  expiresAt: number;
}

export interface PlayerSummary {
  player: KzPlayer | null;
  steamProfile: KzSteamProfile | null;
}

const summaryCache = new Map<string, TimedValue<PlayerSummary>>();
const summaryRequests = new Map<string, Promise<PlayerSummary>>();
const recordsCache = new Map<string, TimedValue<KzRecord[]>>();
const recordsRequests = new Map<string, Promise<KzRecord[]>>();
const steamProfileCache = new Map<string, TimedValue<KzSteamProfile>>();
const steamProfileRequests = new Map<string, Promise<KzSteamProfile | null>>();
const avatarCache = new Map<string, TimedValue<string>>();
const avatarRequests = new Map<string, Promise<string | null>>();

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

function verifyImageUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.src = "";
      resolve(false);
    }, 8000);

    image.onload = () => {
      window.clearTimeout(timer);
      resolve(true);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    image.decoding = "async";
    image.src = url;
  });
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

async function getSteamAvatar(steamId: string): Promise<string | null> {
  const cleanId = sanitizeSteamId(steamId);
  const cached = getFresh(avatarCache, cleanId);
  if (cached) return cached;

  const pending = avatarRequests.get(cleanId);
  if (pending) return pending;

  const request = getSteamProfileDirect(cleanId)
    .then(async (profile) => {
      const avatarUrl = profile?.avatar_url?.trim() || null;
      if (avatarUrl && await verifyImageUrl(avatarUrl)) {
        avatarCache.set(cleanId, {
          value: avatarUrl,
          expiresAt: Date.now() + AVATAR_TTL_MS,
        });
        return avatarUrl;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => avatarRequests.delete(cleanId));

  avatarRequests.set(cleanId, request);
  return request;
}

export async function getSteamAvatarsDirect(
  steamIds: string[],
  onBatch?: (avatars: Record<string, string>) => void
): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set(steamIds.map(sanitizeSteamId).filter(Boolean)));
  const result: Record<string, string> = {};
  let pendingBatch: Record<string, string> = {};
  let flushTimer: number | null = null;
  let cursor = 0;

  const flush = () => {
    if (flushTimer !== null) window.clearTimeout(flushTimer);
    flushTimer = null;
    if (Object.keys(pendingBatch).length === 0) return;
    onBatch?.(pendingBatch);
    pendingBatch = {};
  };

  const queueAvatar = (id: string, avatarUrl: string) => {
    result[id] = avatarUrl;
    pendingBatch[id] = avatarUrl;
    if (Object.keys(pendingBatch).length >= 12) {
      flush();
    } else if (flushTimer === null) {
      flushTimer = window.setTimeout(flush, 75);
    }
  };

  async function worker() {
    while (cursor < uniqueIds.length) {
      const id = uniqueIds[cursor++];
      const avatarUrl = await getSteamAvatar(id);
      if (avatarUrl) queueAvatar(id, avatarUrl);
    }
  }

  const workerCount = Math.min(AVATAR_CONCURRENCY, uniqueIds.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  flush();
  return result;
}
