"use client";

import { useEffect, useState } from "react";
import { sanitizeSteamId } from "@/lib/format";

const STORAGE_KEY = "cs2kz_user_steam_id";

// In-memory module state preserved across client-side route transitions
let hasHydrated = false;
let inMemorySteamId = "";

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)(${name})=([^;]*)`));
  return match ? decodeURIComponent(match[3]) : null;
}

export function getInitialSteamId(): string {
  if (typeof window === "undefined") return "";
  try {
    const cookieId = getCookieValue("cs2kz_steam_id");
    const saved = localStorage.getItem(STORAGE_KEY);
    const initialId = cookieId || saved;
    return initialId ? sanitizeSteamId(initialId) : "";
  } catch {
    return "";
  }
}

export function useUserSteamId() {
  // On initial page load/SSR: start empty to guarantee 100% hydration match.
  // On all subsequent page navigations (already hydrated in-memory): start immediately with stored ID.
  const [userSteamId, setUserSteamIdState] = useState<string>(() => (hasHydrated ? inMemorySteamId : ""));

  useEffect(() => {
    hasHydrated = true;
    const active = getInitialSteamId();
    inMemorySteamId = active;
    if (active) {
      setUserSteamIdState(active);
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        localStorage.setItem(STORAGE_KEY, active);
      }
    }

    // Listen for cross-component storage changes
    const handleChange = () => {
      const current = getInitialSteamId();
      inMemorySteamId = current;
      setUserSteamIdState(current);
    };

    window.addEventListener("storage", handleChange);
    window.addEventListener("user-steam-id-change", handleChange);

    return () => {
      window.removeEventListener("storage", handleChange);
      window.removeEventListener("user-steam-id-change", handleChange);
    };
  }, []);

  const saveSteamId = (rawId: string) => {
    const clean = sanitizeSteamId(rawId);
    inMemorySteamId = clean;
    if (clean) {
      localStorage.setItem(STORAGE_KEY, clean);
      document.cookie = `cs2kz_steam_id=${encodeURIComponent(clean)}; path=/; max-age=31536000; SameSite=Lax`;
      setUserSteamIdState(clean);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      document.cookie = "cs2kz_steam_id=; path=/; max-age=0";
      setUserSteamIdState("");
    }
    window.dispatchEvent(new Event("user-steam-id-change"));
  };

  const clearSteamId = () => {
    inMemorySteamId = "";
    localStorage.removeItem(STORAGE_KEY);
    document.cookie = "cs2kz_steam_id=; path=/; max-age=0";
    setUserSteamIdState("");
    window.dispatchEvent(new Event("user-steam-id-change"));
  };

  return {
    userSteamId,
    saveSteamId,
    clearSteamId,
  };
}
