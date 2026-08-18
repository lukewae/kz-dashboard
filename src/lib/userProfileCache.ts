"use client";

import { sanitizeSteamId } from "@/lib/format";

export interface CachedUserProfile {
  steamId: string;
  name: string;
  avatarUrl: string;
  ckz_rating?: number;
  vnl_rating?: number;
  first_joined_at?: string;
  updatedAt: number;
}

const CACHE_KEY_PREFIX = "cs2kz_profile_cache_";
const inMemoryProfileCache: Record<string, CachedUserProfile> = {};

export function getCachedUserProfile(steamId?: string): CachedUserProfile | null {
  if (typeof window === "undefined" || !steamId) return null;
  try {
    const clean = sanitizeSteamId(steamId);
    if (!clean) return null;
    
    // Check ultra-fast in-memory map first
    if (inMemoryProfileCache[clean]) {
      return inMemoryProfileCache[clean];
    }

    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${clean}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUserProfile;
    inMemoryProfileCache[clean] = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedUserProfile(profile: {
  steamId: string;
  name: string;
  avatarUrl: string;
  ckz_rating?: number;
  vnl_rating?: number;
  first_joined_at?: string;
}) {
  if (typeof window === "undefined" || !profile.steamId) return;
  try {
    const clean = sanitizeSteamId(profile.steamId);
    if (!clean) return;
    const data: CachedUserProfile = {
      ...profile,
      steamId: clean,
      updatedAt: Date.now(),
    };
    inMemoryProfileCache[clean] = data;
    localStorage.setItem(`${CACHE_KEY_PREFIX}${clean}`, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("user-profile-cache-updated", { detail: data }));
  } catch {
    // fallback
  }
}
