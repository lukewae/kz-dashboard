"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserSteamId } from "@/lib/useUserSteamId";
import { sanitizeSteamId } from "@/lib/format";
import { getCachedUserProfile, setCachedUserProfile } from "@/lib/userProfileCache";

export function UserSteamInput() {
  const { userSteamId, saveSteamId, clearSteamId } = useUserSteamId();
  const [inputValue, setInputValue] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Initialize immediately from cached localStorage if available to avoid flash of Steam ID / missing pfp
  const [playerData, setPlayerData] = useState<{
    name: string | null;
    avatarUrl: string | null;
  }>(() => {
    const cached = getCachedUserProfile(userSteamId);
    return {
      name: cached?.name || null,
      avatarUrl: cached?.avatarUrl || null,
    };
  });

  // Fetch / re-validate player name and avatar when userSteamId changes
  useEffect(() => {
    if (!userSteamId) {
      setPlayerData({ name: null, avatarUrl: null });
      return;
    }

    const cleanId = sanitizeSteamId(userSteamId);
    // Instant cache check
    const cached = getCachedUserProfile(cleanId);
    if (cached) {
      setPlayerData({ name: cached.name, avatarUrl: cached.avatarUrl });
    }

    let isMounted = true;

    fetch(`/api/cs2kz/player-summary?steamId=${encodeURIComponent(cleanId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        const name = data.steamProfile?.name || data.player?.name || null;
        const avatarUrl = data.steamProfile?.avatar_url || null;
        setPlayerData({ name, avatarUrl });

        if (name && avatarUrl) {
          setCachedUserProfile({
            steamId: cleanId,
            name,
            avatarUrl,
            ckz_rating: data.player?.ckz_rating,
            vnl_rating: data.player?.vnl_rating,
            first_joined_at: data.player?.first_joined_at,
          });
        }
      })
      .catch((err) => {
        console.error("Failed to fetch sidebar player info:", err);
      });

    const handleCacheUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.steamId === cleanId) {
        setPlayerData({ name: detail.name, avatarUrl: detail.avatarUrl });
      }
    };

    window.addEventListener("user-profile-cache-updated", handleCacheUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("user-profile-cache-updated", handleCacheUpdate);
    };
  }, [userSteamId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      saveSteamId(inputValue.trim());
      setIsEditing(false);
      setShowManualInput(false);
      setInputValue("");
    }
  };

  if (userSteamId && !isEditing) {
    const cached = getCachedUserProfile(userSteamId);
    const displayName = playerData.name || cached?.name || userSteamId;
    const displayAvatar = playerData.avatarUrl || cached?.avatarUrl || null;

    return (
      <div className="sidebar-user-box">
        <div className="sidebar-user-header">
          <span className="sidebar-user-label">LOGGED IN</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              className="sidebar-user-action-btn"
              onClick={() => {
                setInputValue(userSteamId);
                setIsEditing(true);
              }}
              title="Edit Steam ID"
            >
              EDIT
            </button>
            <button
              type="button"
              className="sidebar-user-clear-btn"
              onClick={clearSteamId}
              title="Sign Out / Clear Steam ID"
            >
              LOG OUT
            </button>
          </div>
        </div>

        {/* Clickable Profile Card */}
        <Link
          href={`/profile/${encodeURIComponent(userSteamId)}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 10px",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            textDecoration: "none",
            marginTop: "6px",
            transition: "all 0.15s ease",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            e.currentTarget.style.borderColor = "var(--border-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
          title="Click to view your profile"
        >
          {/* Avatar / PFP */}
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "6px",
              overflow: "hidden",
              background: "#18181c",
              border: "1px solid var(--border)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt={displayName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: "14px", fontFamily: "monospace", color: "var(--text-subtle)", fontWeight: 700 }}>
                {displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>

          {/* Player Name and Steam ID */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#ffffff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: "1.2",
              }}
            >
              {displayName}
            </span>
            <span
              style={{
                fontSize: "10.5px",
                fontFamily: "ui-monospace, monospace",
                color: "var(--text-subtle)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: "1.2",
              }}
            >
              {userSteamId}
            </span>
          </div>

          {/* Subtle indicator */}
          <span style={{ fontSize: "11px", color: "var(--user-blue)", opacity: 0.8, flexShrink: 0 }}>
            ↗
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="sidebar-user-box">
      <div className="sidebar-user-header">
        <span className="sidebar-user-label">HIGHLIGHT YOUR RUNS</span>
        {(isEditing || showManualInput) && (
          <button
            type="button"
            className="sidebar-user-action-btn"
            onClick={() => {
              setIsEditing(false);
              setShowManualInput(false);
              setInputValue("");
            }}
          >
            CANCEL
          </button>
        )}
      </div>

      {!showManualInput && !isEditing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
          {/* 1-Click Steam Login Button */}
          <a
            href="/api/auth/steam/login"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              background: "#171a21",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: 700,
              textDecoration: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#222834";
              e.currentTarget.style.borderColor = "var(--user-blue)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#171a21";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ flexShrink: 0 }}
            >
              <path d="M12 2a10 10 0 0 0-10 10c0 4.7 3.25 8.65 7.66 9.71l2.4-3.51a3.6 3.6 0 0 1-.06-1.2l-3.32-1.37a2.5 2.5 0 0 1-.22-.38 2.5 2.5 0 0 1 4.75-1.57l3.32 1.37c.36-.12.75-.18 1.15-.18a3.67 3.67 0 1 1-3.67 3.67c0-.18.02-.36.05-.53l-2.4 3.5c.74.18 1.51.27 2.3.27a10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 2a8 8 0 0 1 8 8 8 8 0 0 1-8 8c-.68 0-1.34-.09-1.97-.25l2.25-3.29c.45.1.92.15 1.39.15a5.33 5.33 0 1 0-5.33-5.33c0 .54.08 1.06.24 1.55l-3.08-1.27a4.16 4.16 0 0 0 .15-.65 4.17 4.17 0 0 0-7.65-2.02A8 8 0 0 1 12 4z" />
            </svg>
            <span>Sign in with Steam</span>
          </a>

          {/* Manual Input Toggle */}
          <button
            type="button"
            onClick={() => setShowManualInput(true)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-subtle)",
              fontSize: "10px",
              fontFamily: "monospace",
              cursor: "pointer",
              textAlign: "center",
              padding: "2px",
              textDecoration: "underline",
            }}
          >
            or enter Steam ID manually
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="sidebar-user-form">
          <input
            type="text"
            className="sidebar-user-input"
            placeholder="STEAM_1:0:..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
          />
          <button type="submit" className="sidebar-user-save-btn">
            SET
          </button>
        </form>
      )}
    </div>
  );
}
