"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatRank, getPlayerRank, getRankColor, sanitizeSteamId } from "@/lib/format";
import { KzMap, KzPlayer, KzRecord, Mode } from "@/lib/types";
import { useUserSteamId } from "@/lib/useUserSteamId";

interface TopWRPlayer {
  id: string;
  name: string;
  count: number;
}

export function LeaderboardsBrowser({
  topPlayers,
  worldRecords,
  allMaps,
  mode,
}: {
  topPlayers: KzPlayer[];
  worldRecords: KzRecord[];
  allMaps: KzMap[];
  mode: Mode;
}) {
  const { userSteamId } = useUserSteamId();
  const [rankedOnly, setRankedOnly] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [avatarsMap, setAvatarsMap] = useState<Record<string, string>>({});

  // Fast Course Ranked State Lookup Map: `${mapName}_${courseName}` -> boolean
  const courseRankedMap = useMemo<Record<string, boolean>>(() => {
    const mapLookup: Record<string, boolean> = {};
    allMaps.forEach((m) => {
      m.courses?.forEach((c) => {
        const filt = c.filters?.[mode];
        const isRanked = filt?.state === "ranked";
        const key = `${m.name.toLowerCase()}_${c.name.toLowerCase()}`;
        mapLookup[key] = isRanked;
      });
    });
    return mapLookup;
  }, [allMaps, mode]);

  // Aggregate World Record Holders
  const wrHolders = useMemo<TopWRPlayer[]>(() => {
    const playerMap = new Map<string, { id: string; name: string; count: number }>();

    worldRecords.forEach((r) => {
      const mapName = r.map?.name ?? "";
      const courseName = r.course?.name ?? "Main";
      const key = `${mapName.toLowerCase()}_${courseName.toLowerCase()}`;
      const isRanked = courseRankedMap[key] ?? true;

      if (rankedOnly && !isRanked) return;

      const pid = r.player?.id ? sanitizeSteamId(r.player.id) : null;
      if (!pid) return;
      const pname = r.player?.name || pid;

      if (!playerMap.has(pid)) {
        playerMap.set(pid, { id: pid, name: pname, count: 0 });
      }
      playerMap.get(pid)!.count += 1;
    });

    return Array.from(playerMap.values())
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
  }, [worldRecords, rankedOnly, courseRankedMap]);

  // Filtered Rating Players
  const filteredRatingPlayers = useMemo(() => {
    return topPlayers.filter((p) => {
      const name = p.name ?? "";
      const pid = p.id ?? "";
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return name.toLowerCase().includes(q) || pid.toLowerCase().includes(q);
      }
      return true;
    });
  }, [topPlayers, searchQuery]);

  // Filtered WR Players
  const filteredWrHolders = useMemo(() => {
    return wrHolders.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [wrHolders, searchQuery]);

  // Steam IDs to fetch avatars for (visible across both tables)
  const visibleSteamIds = useMemo(() => {
    const ids = new Set<string>();
    filteredRatingPlayers.slice(0, 100).forEach((p) => {
      if (p.id) ids.add(sanitizeSteamId(p.id));
    });
    filteredWrHolders.slice(0, 100).forEach((p) => {
      if (p.id) ids.add(sanitizeSteamId(p.id));
    });
    return Array.from(ids);
  }, [filteredRatingPlayers, filteredWrHolders]);

  useEffect(() => {
    if (visibleSteamIds.length === 0) return;
    let isMounted = true;

    fetch(`/api/cs2kz/avatars?steamids=${encodeURIComponent(visibleSteamIds.join(","))}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && typeof data === "object") {
          setAvatarsMap((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((err) => {
        console.error("Failed to fetch steam avatars:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [visibleSteamIds]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Clean Controls Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: "4px",
        }}
      >
        {/* Left Side: Mode & Track Options */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
          <div className="pill-group">
            <span className="pill-label">Mode:</span>
            <Link
              className={`pill-btn ${mode === "classic" ? "active" : ""}`}
              href="/leaderboards?mode=classic"
            >
              CLASSIC (CKZ)
            </Link>
            <Link
              className={`pill-btn ${mode === "vanilla" ? "active" : ""}`}
              href="/leaderboards?mode=vanilla"
            >
              VANILLA (VNL)
            </Link>
          </div>

          <div className="pill-group">
            <span className="pill-label">Tracks:</span>
            <button
              type="button"
              className={`pill-btn ${rankedOnly ? "active" : ""}`}
              onClick={() => setRankedOnly(true)}
            >
              RANKED ONLY
            </button>
            <button
              type="button"
              className={`pill-btn ${!rankedOnly ? "active" : ""}`}
              onClick={() => setRankedOnly(false)}
            >
              ALL TRACKS
            </button>
          </div>
        </div>

        {/* Right Side: Clean Search Input */}
        <div style={{ minWidth: "260px", maxWidth: "340px", flex: 1 }}>
          <div style={{ position: "relative", width: "100%" }}>
            <input
              type="text"
              placeholder="Search player or Steam ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sidebar-user-input"
              style={{
                padding: "8px 12px",
                fontSize: "12px",
                width: "100%",
                borderRadius: "var(--radius-sm)",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-subtle)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Side-by-Side Dual Leaderboard Grid */}
      <div
        className="leaderboards-grid"
        style={{
          display: "grid",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Rating Points Leaderboard */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--border)",
              background: "var(--panel)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0, letterSpacing: "0.02em" }}>
                Global Rating Leaderboard
              </h2>
              <span style={{ fontSize: "11px", color: "var(--text-subtle)", fontFamily: "monospace" }}>
                Ranked by {mode === "classic" ? "CKZ Points" : "VNL Points"}
              </span>
            </div>
            <span
              className="tag-badge"
              style={{
                color: "var(--text-secondary)",
                borderColor: "var(--border)",
                background: "rgba(255, 255, 255, 0.04)",
                fontSize: "11px",
                padding: "2px 8px",
              }}
            >
              TOP {filteredRatingPlayers.length}
            </span>
          </div>

          <div className="table-container" style={{ border: "none", borderRadius: 0, boxShadow: "none" }}>
            <table className="records-table">
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>#</th>
                  <th>Player</th>
                  <th style={{ width: "110px", textAlign: "right" }}>Points</th>
                  <th style={{ width: "110px", textAlign: "center" }}>Rank Tier</th>
                </tr>
              </thead>
              <tbody>
                {filteredRatingPlayers.map((player, idx) => {
                  const rankNum = idx + 1;
                  const rankColor = getRankColor(rankNum);
                  const rating = mode === "classic" ? player.ckz_rating : player.vnl_rating;
                  const rankInfo = getPlayerRank(rating);
                  const cleanPlayerId = sanitizeSteamId(player.id);
                  const isCurrentUser =
                    !!userSteamId &&
                    cleanPlayerId.toLowerCase() === userSteamId.toLowerCase();
                  const avatarUrl = avatarsMap[cleanPlayerId];
                  const displayName = player.name || cleanPlayerId;

                  return (
                    <tr
                      key={player.id}
                      className={isCurrentUser ? "current-user-row" : ""}
                    >
                      <td
                        className="mono"
                        style={{
                          color: isCurrentUser ? "var(--user-blue)" : rankColor,
                          fontWeight: rankNum <= 3 || isCurrentUser ? 700 : 500,
                        }}
                      >
                        {formatRank(rankNum)}
                      </td>
                      <td>
                        <Link
                          className={`player-link ${isCurrentUser ? "current-user-link" : ""}`}
                          href={`/profile/${cleanPlayerId}?mode=${mode}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}
                        >
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "4px",
                              overflow: "hidden",
                              background: "#18181c",
                              border: "1px solid var(--border)",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--text-subtle)", fontWeight: 700 }}>
                                {displayName.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span style={{ fontWeight: 600 }}>{displayName}</span>
                          {isCurrentUser && <span className="current-user-tag">YOU</span>}
                        </Link>
                      </td>
                      <td
                        className="mono"
                        style={{
                          textAlign: "right",
                          fontWeight: 700,
                          color: rankInfo.color,
                        }}
                      >
                        {rating != null
                          ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(rating))
                          : "0"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className="tag-badge"
                          style={{
                            padding: "2px 7px",
                            fontSize: "10px",
                            fontWeight: 800,
                            color: "#ffffff",
                            backgroundColor: rankInfo.color,
                            borderColor: rankInfo.color,
                          }}
                        >
                          {rankInfo.name}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredRatingPlayers.length === 0 && (
              <div className="empty-state">No players found matching your search.</div>
            )}
          </div>
        </div>

        {/* Right Column: World Records Leaderboard */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--border)",
              background: "var(--panel)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0, letterSpacing: "0.02em" }}>
                World Records Leaderboard
              </h2>
              <span style={{ fontSize: "11px", color: "var(--text-subtle)", fontFamily: "monospace" }}>
                Most #1 Times Held
              </span>
            </div>
            <span
              className="tag-badge"
              style={{
                color: "rgb(255, 215, 0)",
                borderColor: "rgba(255, 215, 0, 0.4)",
                background: "rgba(255, 215, 0, 0.08)",
                fontSize: "11px",
                padding: "2px 8px",
              }}
            >
              {filteredWrHolders.length} WR HOLDERS
            </span>
          </div>

          <div className="table-container" style={{ border: "none", borderRadius: 0, boxShadow: "none" }}>
            <table className="records-table">
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>#</th>
                  <th>Player</th>
                  <th style={{ width: "120px", textAlign: "right" }}>World Records</th>
                  <th style={{ width: "90px", textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredWrHolders.map((player, idx) => {
                  const rankNum = idx + 1;
                  const rankColor = getRankColor(rankNum);
                  const cleanWrId = sanitizeSteamId(player.id);
                  const isCurrentUser =
                    !!userSteamId &&
                    cleanWrId.toLowerCase() === userSteamId.toLowerCase();
                  const avatarUrl = avatarsMap[cleanWrId];
                  const displayName = player.name || cleanWrId;

                  return (
                    <tr
                      key={player.id}
                      className={isCurrentUser ? "current-user-row" : ""}
                    >
                      <td
                        className="mono"
                        style={{
                          color: isCurrentUser ? "var(--user-blue)" : rankColor,
                          fontWeight: rankNum <= 3 || isCurrentUser ? 700 : 500,
                        }}
                      >
                        {formatRank(rankNum)}
                      </td>
                      <td>
                        <Link
                          className={`player-link ${isCurrentUser ? "current-user-link" : ""}`}
                          href={`/profile/${cleanWrId}?mode=${mode}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}
                        >
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "4px",
                              overflow: "hidden",
                              background: "#18181c",
                              border: "1px solid var(--border)",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--text-subtle)", fontWeight: 700 }}>
                                {displayName.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span style={{ fontWeight: 600 }}>{displayName}</span>
                          {isCurrentUser && <span className="current-user-tag">YOU</span>}
                        </Link>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className="tag-badge"
                          style={{
                            color: "rgb(255, 215, 0)",
                            borderColor: "rgba(255, 215, 0, 0.5)",
                            background: "rgba(255, 215, 0, 0.12)",
                            fontWeight: 700,
                            fontSize: "11px",
                            padding: "2px 8px",
                            fontFamily: "ui-monospace, monospace",
                          }}
                        >
                          ★ {player.count} {player.count === 1 ? "WR" : "WRs"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Link
                          href={`/profile/${cleanWrId}?mode=${mode}`}
                          className="btn-minimal"
                          style={{ padding: "2px 8px", fontSize: "11px", display: "inline-block" }}
                        >
                          Profile ↗
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredWrHolders.length === 0 && (
              <div className="empty-state">No world record holders found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
