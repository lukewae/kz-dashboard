"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "kz_favorite_servers";
const EVENT_NAME = "kz_favorite_servers_change";

export function useFavoriteServers() {
  const [favorites, setFavorites] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    setLoaded(true);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setFavorites(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
    };

    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent<number[]>;
      if (customEvent.detail) {
        setFavorites(customEvent.detail);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(EVENT_NAME, handleCustom);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(EVENT_NAME, handleCustom);
    };
  }, []);

  const toggleFavorite = (serverId: number) => {
    setFavorites((prev) => {
      const exists = prev.includes(serverId);
      const next = exists ? prev.filter((id) => id !== serverId) : [...prev, serverId];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const isFavorite = (serverId: number) => favorites.includes(serverId);

  return { favorites, toggleFavorite, isFavorite, loaded };
}
