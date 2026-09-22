"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatRank, getPlayerRank, getRankColor, sanitizeSteamId } from "@/lib/format";
import { KzPlayer, Mode, Page } from "@/lib/types";
import { useUserSteamId } from "@/lib/useUserSteamId";
import { getLeaderboardPlayersPageDirect, getSteamAvatarsDirect, getWrHoldersPageDirect, TopWrPlayer } from "@/lib/clientCs2kz";

const PAGE_SIZE = 10;

function PaginationControls({
  offset,
  total,
  loading,
  onPrevious,
  onNext,
}: {
  offset: number;
  total: number;
  loading: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--border)", background: "var(--panel)" }}>
      <button type="button" className="btn-minimal" onClick={onPrevious} disabled={loading || offset === 0} aria-label="Previous page">
        ←
      </button>
      <span className="mono" style={{ fontSize: "11px", color: "var(--text-subtle)" }}>
        {loading ? "Loading…" : `Page ${currentPage} of ${totalPages}`}
      </span>
      <button type="button" className="btn-minimal" onClick={onNext} disabled={loading || offset + PAGE_SIZE >= total} aria-label="Next page">
        →
      </button>
    </div>
  );
}

export function LeaderboardsBrowser({
  mode,
}: {
  mode: Mode;
}) {
  const { userSteamId } = useUserSteamId();
  const [rankedOnly, setRankedOnly] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [avatarsMap, setAvatarsMap] = useState<Record<string, string>>({});
  const [topPlayersPage, setTopPlayersPage] = useState<Page<KzPlayer>>({ total: 0, values: [] });
  const [wrHoldersPage, setWrHoldersPage] = useState<Page<TopWrPlayer>>({ total: 0, values: [] });
  const [playersOffset, setPlayersOffset] = useState(0);
  const [recordsOffset, setRecordsOffset] = useState(0);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setPlayersOffset(0);
    setPlayersLoading(true);

    getLeaderboardPlayersPageDirect(mode, 0, PAGE_SIZE)
      .then((page) => {
        if (active) setTopPlayersPage(page);
      })
      .catch((error) => console.error("Failed to load rating leaderboard:", error))
      .finally(() => {
        if (active) setPlayersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode]);

  useEffect(() => {
    let active = true;
    setRecordsOffset(0);
    setRecordsLoading(true);
    getWrHoldersPageDirect(mode, 0, rankedOnly)
      .then((page) => {
        if (active) setWrHoldersPage(page);
      })
      .catch((error) => console.error("Failed to load WR holders:", error))
      .finally(() => {
        if (active) setRecordsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, rankedOnly]);

  // Filtered Rating Players
  const filteredRatingPlayers = useMemo(() => {
    return topPlayersPage.values.filter((p) => {
      const name = p.name ?? "";
      const pid = p.id ?? "";
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return name.toLowerCase().includes(q) || pid.toLowerCase().includes(q);
      }
      return true;
    });
  }, [topPlayersPage, searchQuery]);

  const filteredWrHolders = useMemo(() => {
    return wrHoldersPage.values.filter((player) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return player.name.toLowerCase().includes(q) || player.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [wrHoldersPage, searchQuery]);

  // Steam IDs to fetch avatars for (visible across both tables)
  const visibleSteamIds = useMemo(() => {
    const ids = new Set<string>();
    filteredRatingPlayers.forEach((p) => {
      if (p.id) ids.add(sanitizeSteamId(p.id));
    });
    filteredWrHolders.forEach((player) => {
      if (player.id) ids.add(sanitizeSteamId(player.id));
    });
    return Array.from(ids);
  }, [filteredRatingPlayers, filteredWrHolders]);

  const loadPlayersPage = async (nextOffset: number) => {
    if (playersLoading || nextOffset < 0) return;
    setPlayersLoading(true);
    try {
      const page = await getLeaderboardPlayersPageDirect(mode, nextOffset, PAGE_SIZE);
      setTopPlayersPage(page);
      setPlayersOffset(nextOffset);
    } catch (error) {
      console.error("Failed to load rating leaderboard page:", error);
    } finally {
      setPlayersLoading(false);
    }
  };

  const loadRecordsPage = async (nextOffset: number) => {
    if (recordsLoading || nextOffset < 0) return;
    setRecordsLoading(true);
    try {
      const page = await getWrHoldersPageDirect(mode, nextOffset, rankedOnly);
      setWrHoldersPage(page);
      setRecordsOffset(nextOffset);
    } catch (error) {
      console.error("Failed to load world records page:", error);
    } finally {
      setRecordsLoading(false);
    }
  };

  const changeRankedOnly = (nextRankedOnly: boolean) => {
    if (rankedOnly === nextRankedOnly) return;
    setRankedOnly(nextRankedOnly);
  };

  useEffect(() => {
    if (visibleSteamIds.length === 0) return;
    let isMounted = true;

    getSteamAvatarsDirect(visibleSteamIds, (data) => {
      if (isMounted) setAvatarsMap((prev) => ({ ...prev, ...data }));
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
              prefetch={false}
            >
              CLASSIC (CKZ)
            </Link>
            <Link
              className={`pill-btn ${mode === "vanilla" ? "active" : ""}`}
              href="/leaderboards?mode=vanilla"
              prefetch={false}
            >
              VANILLA (VNL)
            </Link>
          </div>

          <div className="pill-group">
            <span className="pill-label">Tracks:</span>
            <button
              type="button"
              className={`pill-btn ${rankedOnly ? "active" : ""}`}
              onClick={() => changeRankedOnly(true)}
              disabled={recordsLoading}
            >
              RANKED ONLY
            </button>
            <button
              type="button"
              className={`pill-btn ${!rankedOnly ? "active" : ""}`}
              onClick={() => changeRankedOnly(false)}
              disabled={recordsLoading}
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
              {playersLoading ? "LOADING" : `${topPlayersPage.total.toLocaleString()} PLAYERS`}
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
                  const rankNum = playersOffset + idx + 1;
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
                          prefetch={false}
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
                                loading="lazy"
                                decoding="async"
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
              <div className="empty-state">
                {playersLoading ? "Loading 10 players…" : "No players found matching your search."}
              </div>
            )}
          </div>
          <PaginationControls
            offset={playersOffset}
            total={topPlayersPage.total}
            loading={playersLoading}
            onPrevious={() => void loadPlayersPage(playersOffset - PAGE_SIZE)}
            onNext={() => void loadPlayersPage(playersOffset + PAGE_SIZE)}
          />
        </div>

        {/* Right Column: World Record Holders */}
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
              {recordsLoading ? "LOADING" : `${wrHoldersPage.total.toLocaleString()} WR HOLDERS`}
            </span>
          </div>

          <div className="table-container" style={{ border: "none", borderRadius: 0, boxShadow: "none" }}>
            <table className="records-table">
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>#</th>
                  <th>Player</th>
                  <th style={{ width: "140px", textAlign: "right" }}>World Records</th>
                  <th style={{ width: "90px", textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredWrHolders.map((player, idx) => {
                  const rankNum = recordsOffset + idx + 1;
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
                          prefetch={false}
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
                                loading="lazy"
                                decoding="async"
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
                          prefetch={false}
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
              <div className="empty-state">
                {recordsLoading ? "Loading WR holders…" : "No world record holders found."}
              </div>
            )}
          </div>
          <PaginationControls
            offset={recordsOffset}
            total={wrHoldersPage.total}
            loading={recordsLoading}
            onPrevious={() => void loadRecordsPage(recordsOffset - PAGE_SIZE)}
            onNext={() => void loadRecordsPage(recordsOffset + PAGE_SIZE)}
          />
        </div>
      </div>
    </div>
  );
}
