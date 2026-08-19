"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatRank, formatRelativeTime, formatTime, getMapImageUrl, getNextPlayerRank, getPlayerRank, getRankColor, getRecordTimestamp, getTierInfo, resolveCanonicalTier, sanitizeSteamId } from "@/lib/format";
import { KzMap, KzPlayer, KzRecord, KzServer, KzSteamProfile, Mode, Tier } from "@/lib/types";
import { useUserSteamId } from "@/lib/useUserSteamId";
import { useFavoriteServers } from "@/lib/useFavoriteServers";
import { CountryFlag, formatLocation, normalizeServerGeo, ServerMapThumb } from "@/components/ServersBrowser";
import { MapRoulette } from "@/components/MapRoulette";
import { PlayerActivityWidget } from "@/components/PlayerActivityWidget";
import { getCachedUserProfile, setCachedUserProfile } from "@/lib/userProfileCache";

export function OverviewDashboard({
  mode,
  recentWrs,
  topPointsPlayers,
  allMaps,
  allServers = [],
}: {
  mode: Mode;
  recentWrs: KzRecord[];
  topPointsPlayers: KzPlayer[];
  allWorldRecords: KzRecord[];
  allMaps: KzMap[];
  allServers?: KzServer[];
}) {
  const { userSteamId } = useUserSteamId();
  const [avatarsMap, setAvatarsMap] = useState<Record<string, string>>({});
  const [userRecords, setUserRecords] = useState<KzRecord[]>([]);
  const [userRecordsLoading, setUserRecordsLoading] = useState(false);
  const { isFavorite, toggleFavorite, favorites } = useFavoriteServers();
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(true);
  const [copiedServerId, setCopiedServerId] = useState<number | null>(null);

  const favoriteServersList = useMemo(() => {
    return allServers.filter((s) => isFavorite(s.id));
  }, [allServers, isFavorite, favorites]);

  const copyServerConnect = (server: KzServer) => {
    const connectCmd = `connect ${server.host}:${server.port}`;
    navigator.clipboard.writeText(connectCmd);
    setCopiedServerId(server.id);
    setTimeout(() => {
      setCopiedServerId((prev) => (prev === server.id ? null : prev));
    }, 2000);
  };
  const [isIncompleteOpen, setIsIncompleteOpen] = useState(false);

  // Initialize immediately from cached localStorage if available to avoid flash of Steam ID / missing pfp
  const [currentUserData, setCurrentUserData] = useState<{
    player: KzPlayer | null;
    steamProfile: KzSteamProfile | null;
    loading: boolean;
  }>(() => {
    const cached = getCachedUserProfile(userSteamId);
    if (cached) {
      return {
        player: {
          id: cached.steamId,
          name: cached.name,
          ckz_rating: cached.ckz_rating ?? 0,
          vnl_rating: cached.vnl_rating ?? 0,
          first_joined_at: cached.first_joined_at ?? "",
        } as KzPlayer,
        steamProfile: {
          id: cached.steamId,
          name: cached.name,
          avatar_url: cached.avatarUrl,
          profile_url: `https://steamcommunity.com/profiles/${cached.steamId}`,
        },
        loading: false,
      };
    }
    return {
      player: null,
      steamProfile: null,
      loading: false,
    };
  });

  // Collect all unique Steam IDs visible on this page to batch fetch their avatars
  const visibleSteamIds = useMemo(() => {
    const ids = new Set<string>();
    if (userSteamId) ids.add(sanitizeSteamId(userSteamId));

    recentWrs.slice(0, 15).forEach((r) => {
      if (r.player?.id) ids.add(sanitizeSteamId(r.player.id));
    });

    topPointsPlayers.slice(0, 10).forEach((p) => {
      if (p.id) ids.add(sanitizeSteamId(p.id));
    });

    return Array.from(ids);
  }, [recentWrs, topPointsPlayers, userSteamId]);

  // Fetch avatars for all visible players
  useEffect(() => {
    if (visibleSteamIds.length === 0) return;

    fetch(`/api/cs2kz/avatars?steamids=${encodeURIComponent(visibleSteamIds.join(","))}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setAvatarsMap((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((err) => console.error("Failed to load avatars:", err));
  }, [visibleSteamIds]);

  // Fetch tracked user summary dynamically (with instant cache fill)
  useEffect(() => {
    if (!userSteamId) {
      setCurrentUserData({ player: null, steamProfile: null, loading: false });
      return;
    }

    const cleanId = sanitizeSteamId(userSteamId);
    const cached = getCachedUserProfile(cleanId);
    if (cached) {
      setCurrentUserData((prev) => ({
        ...prev,
        player: {
          id: cached.steamId,
          name: cached.name,
          ckz_rating: cached.ckz_rating ?? (prev.player?.ckz_rating ?? 0),
          vnl_rating: cached.vnl_rating ?? (prev.player?.vnl_rating ?? 0),
          first_joined_at: cached.first_joined_at ?? (prev.player?.first_joined_at ?? ""),
        },
        steamProfile: {
          id: cached.steamId,
          name: cached.name,
          avatar_url: cached.avatarUrl,
          profile_url: `https://steamcommunity.com/profiles/${cached.steamId}`,
        },
      }));
    }

    let isMounted = true;
    setCurrentUserData((prev) => ({ ...prev, loading: true }));

    fetch(`/api/cs2kz/player-summary?steamId=${encodeURIComponent(cleanId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setCurrentUserData({
            player: data.player,
            steamProfile: data.steamProfile,
            loading: false,
          });

          const name = data.steamProfile?.name || data.player?.name;
          const avatarUrl = data.steamProfile?.avatar_url;
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
        } else {
          setCurrentUserData({ player: null, steamProfile: null, loading: false });
        }
      })
      .catch((err) => {
        console.error("Failed to load user summary:", err);
        if (isMounted) setCurrentUserData({ player: null, steamProfile: null, loading: false });
      });

    return () => {
      isMounted = false;
    };
  }, [userSteamId]);

  // Fetch tracked user's records for incomplete calculation
  useEffect(() => {
    if (!userSteamId) {
      setUserRecords([]);
      return;
    }

    let isMounted = true;
    setUserRecordsLoading(true);

    fetch(`/api/cs2kz/records?player=${encodeURIComponent(userSteamId)}&mode=${mode}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data?.records) {
          setUserRecords(data.records);
        } else {
          setUserRecords([]);
        }
        setUserRecordsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load user records for overview widget:", err);
        if (isMounted) setUserRecordsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userSteamId, mode]);

  // Map Image Lookup Map: `${mapName}` -> image_url
  const mapImageMap = useMemo<Record<string, string>>(() => {
    const mapLookup: Record<string, string> = {};
    allMaps.forEach((m) => {
      if (m.image_url) {
        mapLookup[m.name.toLowerCase()] = m.image_url;
      }
    });
    return mapLookup;
  }, [allMaps]);

  // Set of completed course keys: `${mapName}_${courseName}`
  const completedCourseKeys = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    userRecords.forEach((r) => {
      const mapName = r.map?.name ?? "";
      const courseName = r.course?.name ?? "Main";
      set.add(`${mapName.toLowerCase()}_${courseName.toLowerCase()}`);
    });
    return set;
  }, [userRecords]);

  // Incomplete Ranked Courses for active mode
  const incompleteRankedCourses = useMemo(() => {
    const list: {
      id: string;
      mapName: string;
      courseName: string;
      tierKey: Tier | null;
      tierLevel: number;
    }[] = [];

    let totalRankedCount = 0;
    let completedRankedCount = 0;

    allMaps.forEach((m) => {
      if (m.state?.toLowerCase() === "invalid") return;
      m.courses?.forEach((c) => {
        const filt = c.filters?.[mode];
        if (filt?.state !== "ranked") return;

        totalRankedCount += 1;
        const key = `${m.name.toLowerCase()}_${c.name.toLowerCase()}`;
        const isCompleted = completedCourseKeys.has(key);

        if (isCompleted) {
          completedRankedCount += 1;
        } else {
          const tierKey = resolveCanonicalTier(filt?.nub_tier, filt?.pro_tier);
          const lvl = getTierInfo(tierKey).level;
          list.push({
            id: `${m.name}_${c.name}`,
            mapName: m.name,
            courseName: c.name,
            tierKey,
            tierLevel: lvl,
          });
        }
      });
    });

    list.sort((a, b) => {
      if (a.tierLevel !== b.tierLevel) return a.tierLevel - b.tierLevel;
      return a.mapName.localeCompare(b.mapName);
    });

    return {
      items: list,
      total: totalRankedCount,
      completed: completedRankedCount,
      percent: totalRankedCount > 0 ? Math.round((completedRankedCount / totalRankedCount) * 100) : 0,
    };
  }, [allMaps, mode, completedCourseKeys]);

  const cachedUser = getCachedUserProfile(userSteamId);
  const userRating = mode === "classic"
    ? (currentUserData.player?.ckz_rating ?? cachedUser?.ckz_rating)
    : (currentUserData.player?.vnl_rating ?? cachedUser?.vnl_rating);
  const userRankInfo = getPlayerRank(userRating);
  const nextRankGoal = userRating != null ? getNextPlayerRank(userRating) : null;
  const userAvatar = currentUserData.steamProfile?.avatar_url || cachedUser?.avatarUrl || (userSteamId ? avatarsMap[sanitizeSteamId(userSteamId)] : null);
  const userName = currentUserData.steamProfile?.name || currentUserData.player?.name || cachedUser?.name || userSteamId;

  const formattedPoints =
    userRating != null
      ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(userRating))
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px", paddingTop: "16px" }}>
      {/* 1. Unboxed Scaled-Up Hero Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "24px",
        }}
      >
        {/* Left Side: Avatar + Welcome & Points Stack */}
        {userSteamId ? (
          <div style={{ display: "flex", alignItems: "center", gap: "20px", minWidth: 0 }}>
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName || "Player"}
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  objectFit: "cover",
                  background: "var(--panel)",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "var(--panel)",
                  color: "var(--text-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "20px",
                  fontFamily: "monospace",
                  flexShrink: 0,
                }}
              >
                KZ
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
              <h1 style={{ fontSize: "32px", fontWeight: 400, margin: 0, color: "#ffffff", letterSpacing: "-0.015em" }}>
                Welcome back, <span style={{ fontWeight: 600 }}>{userName}</span>
              </h1>

              {formattedPoints && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: "15px",
                      fontFamily: "ui-monospace, monospace",
                      color: userRankInfo.color,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{formattedPoints}</span>{" "}
                    <span style={{ fontWeight: 400, opacity: 0.9, color: userRankInfo.color }}>Points</span>
                  </span>

                  <span
                    className="tag-badge"
                    style={{
                      fontSize: "10px",
                      fontWeight: 800,
                      color: "#ffffff",
                      backgroundColor: userRankInfo.color,
                      borderColor: userRankInfo.color,
                      padding: "2px 7px",
                    }}
                  >
                    {userRankInfo.name}
                  </span>

                  {/* Next Rank Threshold Goal (shown only if under Legend rank) */}
                  {nextRankGoal && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        color: "var(--text-subtle)",
                        fontFamily: "monospace",
                      }}
                    >
                      <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>
                      <span>
                        <strong style={{ color: "#ffffff", fontWeight: 700 }}>
                          {nextRankGoal.pointsNeeded.toLocaleString("en-US")}
                        </strong>{" "}
                        pts til
                      </span>
                      <span
                        className="tag-badge"
                        style={{
                          fontSize: "9.5px",
                          fontWeight: 800,
                          color: "#ffffff",
                          backgroundColor: nextRankGoal.nextRank.color,
                          borderColor: nextRankGoal.nextRank.color,
                          padding: "1px 6px",
                          borderRadius: "3px",
                        }}
                      >
                        {nextRankGoal.nextRank.name}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h1 style={{ fontSize: "32px", fontWeight: 400, margin: "0 0 6px 0", color: "#ffffff", letterSpacing: "-0.015em" }}>
              Welcome to <span style={{ fontWeight: 600 }}>CS2KZ Viewer</span>
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
              Enter your SteamID in the sidebar to track completion stats, rating points, and personal leaderboard records.
            </p>
          </div>
        )}

        {/* Right Side: Mode Switcher + View Profile Button (Positioned down to accompany scaled greeting) */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", paddingBottom: "4px" }}>
          {/* Mode Switcher */}
          <div className="pill-group">
            <span className="pill-label">Mode:</span>
            <Link
              className={`pill-btn ${mode === "classic" ? "active" : ""}`}
              href="/?mode=classic"
            >
              CLASSIC (CKZ)
            </Link>
            <Link
              className={`pill-btn ${mode === "vanilla" ? "active" : ""}`}
              href="/?mode=vanilla"
            >
              VANILLA (VNL)
            </Link>
          </div>

          {/* Action Button (shown when Steam ID is configured) */}
          {userSteamId && (
            <Link
              href={`/profile/${encodeURIComponent(userSteamId)}?mode=${mode}`}
              className="btn-minimal"
              style={{
                background: "var(--user-blue)",
                color: "#ffffff",
                borderColor: "var(--user-blue)",
                fontWeight: 700,
                padding: "7px 16px",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              View Profile ↗
            </Link>
          )}
        </div>
      </div>

      {/* 2. Featured Grid: Map Roulette (Practice) & Rating Progression (WIP Graph) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: "24px",
          alignItems: "stretch",
        }}
      >
        {/* Left Column: Map Roulette Practice Picker */}
        <div style={{ height: "100%" }}>
          <MapRoulette
            allMaps={allMaps}
            mode={mode}
            userRecords={userRecords}
            userSteamId={userSteamId}
            mapImageMap={mapImageMap}
          />
        </div>

        {/* Right Column: Player Activity Heatmap & Notable Milestones */}
        <div style={{ height: "100%" }}>
          <PlayerActivityWidget
            userRecords={userRecords}
            userSteamId={userSteamId}
            mode={mode}
            mapImageMap={mapImageMap}
          />
        </div>
      </div>

      {/* 3. Unfinished Maps & Courses Progress Widget (Collapsible) */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: isIncompleteOpen ? "14px" : "0px",
          transition: "all 0.2s ease",
        }}
      >
        {/* Widget Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => setIsIncompleteOpen((prev) => !prev)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "22px",
                height: "22px",
                borderRadius: "5px",
                background: isIncompleteOpen ? "rgba(95, 153, 217, 0.2)" : "rgba(255, 255, 255, 0.06)",
                border: `1px solid ${isIncompleteOpen ? "var(--user-blue)" : "var(--border)"}`,
                color: isIncompleteOpen ? "#ffffff" : "var(--user-blue)",
                fontSize: "10px",
                transition: "transform 0.2s ease, background 0.2s ease",
                transform: isIncompleteOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▼
            </span>

            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#ffffff", letterSpacing: "0.02em" }}>
              Remaining Incomplete Maps
            </h3>
            {userSteamId && (
              <>
                <span style={{ fontSize: "12px", color: "var(--text-subtle)" }}>•</span>
                <span style={{ fontSize: "12.5px", color: "#ffffff", fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
                  {incompleteRankedCourses.items.length} remaining
                </span>
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {userSteamId ? (
              <>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "ui-monospace, monospace" }}>
                  {incompleteRankedCourses.completed} / {incompleteRankedCourses.total} Completed ({incompleteRankedCourses.percent}%)
                </span>
                <Link
                  href={`/profile/${encodeURIComponent(userSteamId)}?mode=${mode}`}
                  style={{ fontSize: "11px", color: "var(--user-blue)", textDecoration: "none", fontFamily: "monospace", fontWeight: 600 }}
                  className="hover-underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View on Profile →
                </Link>
              </>
            ) : (
              <span style={{ fontSize: "12px", color: "var(--text-subtle)", fontFamily: "monospace" }}>
                {mode === "classic" ? "CLASSIC KZ" : "VANILLA KZ"}
              </span>
            )}

            <button
              type="button"
              className="btn-minimal"
              style={{
                fontSize: "11.5px",
                padding: "3px 10px",
                fontFamily: "ui-monospace, monospace",
                fontWeight: 700,
                color: isIncompleteOpen ? "#ffffff" : "var(--text)",
                background: isIncompleteOpen ? "rgba(95, 153, 217, 0.2)" : "rgba(255, 255, 255, 0.06)",
                borderColor: isIncompleteOpen ? "var(--user-blue)" : "var(--border)",
                borderRadius: "5px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsIncompleteOpen((prev) => !prev);
              }}
            >
              <span>{isIncompleteOpen ? "Collapse" : "Expand List"}</span>
              <span style={{ fontSize: "9px", color: "var(--user-blue)" }}>{isIncompleteOpen ? "▲" : "▼"}</span>
            </button>
          </div>
        </div>

        {isIncompleteOpen && (
          <>
            {/* Progress Bar */}
            {userSteamId && incompleteRankedCourses.total > 0 && (
              <div
                style={{
                  width: "100%",
                  height: "4px",
                  background: "rgba(255, 255, 255, 0.06)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${incompleteRankedCourses.percent}%`,
                    height: "100%",
                    background: "var(--user-blue)",
                    boxShadow: "0 0 8px rgba(95, 153, 217, 0.4)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            )}

            {/* Unfinished Courses Grid */}
            {userSteamId ? (
              userRecordsLoading ? (
                <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-subtle)", fontSize: "12px" }}>
                  Checking map completion status...
                </div>
              ) : incompleteRankedCourses.items.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "10px",
                    maxHeight: "220px",
                    overflowY: "auto",
                    paddingRight: "4px",
                  }}
                >
                  {incompleteRankedCourses.items.map((course) => {
                    const tierInfo = getTierInfo(course.tierKey);
                    const mapImage = mapImageMap[course.mapName.toLowerCase()] || getMapImageUrl(course.mapName);

                    return (
                      <Link
                        key={course.id}
                        href={`/maps/${encodeURIComponent(course.mapName)}?course=${encodeURIComponent(course.courseName)}&mode=${mode}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "7px 10px",
                          background: "var(--panel)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          textDecoration: "none",
                          transition: "all 0.15s ease",
                        }}
                        className="hover-card-border"
                      >
                        {/* Map Thumbnail */}
                        <div
                          style={{
                            width: "52px",
                            height: "32px",
                            borderRadius: "4px",
                            overflow: "hidden",
                            border: "1px solid var(--border)",
                            background: "#0d0d10",
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={mapImage}
                            alt={course.mapName}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = getMapImageUrl(course.mapName);
                            }}
                          />
                        </div>

                        {/* Info */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                            <span
                              style={{
                                color: "#ffffff",
                                fontWeight: 700,
                                fontSize: "12px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {course.mapName}
                            </span>
                            <span
                              className="tag-badge"
                              style={{
                                padding: "1px 4px",
                                fontSize: "8.5px",
                                fontWeight: 800,
                                color: "#ffffff",
                                backgroundColor: tierInfo.color,
                                borderColor: tierInfo.color,
                                flexShrink: 0,
                              }}
                            >
                              {tierInfo.short}
                            </span>
                          </div>
                          <span style={{ fontSize: "10.5px", color: "var(--text-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {course.courseName}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: "20px 0", textAlign: "center", color: "rgb(74, 222, 128)", fontSize: "13px", fontWeight: 600 }}>
                  🏆 All ranked courses completed for this mode!
                </div>
              )
            ) : (
              <div style={{ padding: "16px 0", color: "var(--text-muted)", fontSize: "12px" }}>
                Enter your Steam ID to view and track your remaining incomplete maps for practice and completion goals.
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. Favorite Servers Dropdown Widget */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: isFavoritesOpen ? "14px" : "0px",
          transition: "all 0.2s ease",
        }}
      >
        {/* Widget Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => setIsFavoritesOpen((prev) => !prev)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "22px",
                height: "22px",
                borderRadius: "5px",
                background: isFavoritesOpen ? "rgba(251, 191, 36, 0.2)" : "rgba(255, 255, 255, 0.06)",
                border: `1px solid ${isFavoritesOpen ? "rgb(251, 191, 36)" : "var(--border)"}`,
                color: isFavoritesOpen ? "rgb(251, 191, 36)" : "var(--text-subtle)",
                fontSize: "10px",
                transition: "transform 0.2s ease, background 0.2s ease",
                transform: isFavoritesOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▼
            </span>

            <span style={{ fontSize: "15px", color: "rgb(251, 191, 36)" }}>★</span>

            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#ffffff", letterSpacing: "0.02em" }}>
              Favorite Servers
            </h3>

            <span style={{ fontSize: "12px", color: "var(--text-subtle)" }}>•</span>
            <span style={{ fontSize: "12.5px", color: "#ffffff", fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
              {favoriteServersList.length} {favoriteServersList.length === 1 ? "Server" : "Servers"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Link
              href="/servers"
              style={{ fontSize: "11.5px", color: "var(--user-blue)", textDecoration: "none", fontFamily: "monospace", fontWeight: 600 }}
              className="hover-underline"
              onClick={(e) => e.stopPropagation()}
            >
              Browse All Servers →
            </Link>

            <button
              type="button"
              className="btn-minimal"
              style={{
                fontSize: "11.5px",
                padding: "3px 10px",
                fontFamily: "ui-monospace, monospace",
                fontWeight: 700,
                color: isFavoritesOpen ? "#ffffff" : "var(--text)",
                background: isFavoritesOpen ? "rgba(95, 153, 217, 0.2)" : "rgba(255, 255, 255, 0.06)",
                borderColor: isFavoritesOpen ? "var(--user-blue)" : "var(--border)",
                borderRadius: "5px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsFavoritesOpen((prev) => !prev);
              }}
            >
              <span>{isFavoritesOpen ? "Collapse" : "Expand"}</span>
              <span style={{ fontSize: "9px", color: "var(--user-blue)" }}>{isFavoritesOpen ? "▲" : "▼"}</span>
            </button>
          </div>
        </div>

        {/* Widget Body */}
        {isFavoritesOpen && (
          <div style={{ paddingTop: "4px" }}>
            {favoriteServersList.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                  gap: "14px",
                }}
              >
                {favoriteServersList.map((server) => {
                  const a2s = server.a2s_info;
                  const normalized = normalizeServerGeo(server);
                  const currentMap = a2s?.current_map || "unknown";
                  const numPlayers = a2s?.num_players || 0;
                  const maxPlayers = a2s?.max_players || 0;
                  const percent = maxPlayers > 0 ? Math.min(100, Math.round((numPlayers / maxPlayers) * 100)) : 0;
                  const isCopied = copiedServerId === server.id;

                  return (
                    <div
                      key={server.id}
                      style={{
                        background: "var(--panel)",
                        border: "1px solid rgba(251, 191, 36, 0.35)",
                        borderRadius: "var(--radius-sm)",
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {/* Top row */}
                      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "10px", alignItems: "center" }}>
                        <div style={{ width: "80px" }}>
                          <ServerMapThumb mapName={currentMap} size="sm" />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                            <span
                              style={{
                                fontSize: "13px",
                                fontWeight: 700,
                                color: "#ffffff",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={server.name}
                            >
                              {server.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleFavorite(server.id)}
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "14px",
                                color: "rgb(251, 191, 36)",
                                padding: 0,
                              }}
                              title="Remove from favorites"
                            >
                              ★
                            </button>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-subtle)" }}>
                            <CountryFlag countryCode={normalized.countryCode} size="sm" />
                            <span style={{ fontWeight: 600 }}>{formatLocation(normalized.countryCode, normalized.region)}</span>
                            <span>•</span>
                            <Link href={`/maps/${encodeURIComponent(currentMap)}`} style={{ color: "var(--user-blue)", textDecoration: "none" }} className="hover-underline">
                              {currentMap}
                            </Link>
                          </div>
                        </div>
                      </div>

                      {/* Player Progress Bar */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", fontFamily: "monospace" }}>
                          <span style={{ color: numPlayers > 0 ? "rgb(74, 222, 128)" : "var(--text-subtle)", fontWeight: 600 }}>
                            {numPlayers} / {maxPlayers} Players
                          </span>
                          <span style={{ color: "var(--text-subtle)" }}>{percent}%</span>
                        </div>
                        <div style={{ height: "3px", width: "100%", borderRadius: "1.5px", background: "rgba(255, 255, 255, 0.06)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${percent}%`, background: numPlayers > 0 ? "rgb(74, 222, 128)" : "transparent" }} />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "6px", alignItems: "center", paddingTop: "4px" }}>
                        <button
                          type="button"
                          onClick={() => copyServerConnect(server)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "5px",
                            padding: "4px 8px",
                            borderRadius: "3px",
                            fontSize: "10.5px",
                            fontWeight: 700,
                            fontFamily: "ui-monospace, monospace",
                            background: isCopied ? "rgba(74, 222, 128, 0.2)" : "rgba(255, 255, 255, 0.05)",
                            border: `1px solid ${isCopied ? "rgb(74, 222, 128)" : "var(--border)"}`,
                            color: isCopied ? "rgb(74, 222, 128)" : "#ffffff",
                            cursor: "pointer",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title="Copy connect command"
                        >
                          <span>{isCopied ? "✓" : "📋"}</span>
                          <span>{isCopied ? "Copied!" : `connect ${server.host}:${server.port}`}</span>
                        </button>

                        <a
                          href={`steam://connect/${server.host}:${server.port}`}
                          className="btn-minimal"
                          style={{
                            padding: "4px 10px",
                            fontSize: "10.5px",
                            fontWeight: 700,
                            background: "var(--user-blue)",
                            borderColor: "var(--user-blue)",
                            color: "#ffffff",
                            textDecoration: "none",
                          }}
                        >
                          Join ↗
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: "20px 0",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--text-subtle)",
                }}
              >
                <div style={{ fontSize: "20px", color: "rgb(251, 191, 36)" }}>☆</div>
                <div style={{ fontSize: "13px", color: "#ffffff", fontWeight: 600 }}>No favorite servers added yet</div>
                <p style={{ fontSize: "11.5px", margin: 0, maxWidth: "420px", color: "var(--text-muted)" }}>
                  Star servers on the <Link href="/servers" style={{ color: "var(--user-blue)", textDecoration: "none", fontWeight: 600 }}>Servers page</Link> to monitor them directly from your dashboard.
                </p>
                <Link href="/servers" className="btn-minimal" style={{ marginTop: "6px", fontSize: "11px", padding: "5px 12px" }}>
                  Browse Servers →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Main Split Section: Recent World Records (Left) & Top Players by Rating (Right) */}
      <div
        className="overview-split-grid"
        style={{
          display: "grid",
          gap: "28px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Recent World Records (Compact Individual Cards) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: "2px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em", color: "#ffffff" }}>
              Recent World Records
            </h3>
            <Link
              href={`/leaderboards?mode=${mode}`}
              style={{ fontSize: "11px", color: "var(--text-subtle)", textDecoration: "none", fontFamily: "monospace" }}
              className="hover-underline"
            >
              All Leaderboards →
            </Link>
          </div>

          {/* Individual Compact WR Cards Stack */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {recentWrs.slice(0, 7).map((r) => {
              const mapName = r.map?.name ?? "Unknown Map";
              const courseName = r.course?.name ?? "Main";
              const isPro = r.teleports === 0;
              const tierKey = resolveCanonicalTier(r.course?.nub_tier, r.course?.pro_tier);
              const tierInfo = getTierInfo(tierKey);
              const cleanPlayerId = r.player?.id ? sanitizeSteamId(r.player.id) : null;
              const playerAvatar = cleanPlayerId ? avatarsMap[cleanPlayerId] : null;
              const recordDate = getRecordTimestamp(r.id);
              const relativeTime = formatRelativeTime(recordDate);
              const mapImage = mapImageMap[mapName.toLowerCase()] || getMapImageUrl(mapName);
              const isCurrentUser =
                !!userSteamId &&
                !!cleanPlayerId &&
                cleanPlayerId.toLowerCase() === userSteamId.toLowerCase();

              return (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "12px 16px",
                    background: isCurrentUser ? "rgba(95, 153, 217, 0.08)" : "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    transition: "border-color 0.15s ease",
                  }}
                  className="hover-card-border"
                >
                  {/* Left Side: Map Thumbnail Image */}
                  <Link
                    href={`/maps/${encodeURIComponent(mapName)}?course=${encodeURIComponent(courseName)}&mode=${mode}`}
                    style={{
                      width: "96px",
                      height: "54px",
                      flexShrink: 0,
                      borderRadius: "6px",
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      background: "#0d0d10",
                      display: "block",
                      position: "relative",
                    }}
                  >
                    <img
                      src={mapImage}
                      alt={mapName}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = getMapImageUrl(mapName);
                      }}
                    />
                  </Link>

                  {/* Right Side: Metadata Stack */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0, flex: 1 }}>
                    {/* Top Row: Type + Map - Course + Tier Badge + Time */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flexWrap: "wrap" }}>
                        {isPro ? (
                          <span className="run-type-pro">PRO</span>
                        ) : (
                          <span className="run-type-tp">TP</span>
                        )}

                        <Link
                          href={`/maps/${encodeURIComponent(mapName)}?course=${encodeURIComponent(courseName)}&mode=${mode}`}
                          style={{
                            color: "#ffffff",
                            fontWeight: 700,
                            fontSize: "14px",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          className="hover-underline"
                        >
                          {mapName}
                          <span style={{ color: "var(--text-subtle)", fontWeight: 500, marginLeft: "4px" }}>
                            - {courseName}
                          </span>
                        </Link>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        <span
                          className="tag-badge"
                          style={{
                            padding: "2px 7px",
                            fontSize: "10px",
                            fontWeight: 800,
                            color: "#ffffff",
                            backgroundColor: tierInfo.color,
                            borderColor: tierInfo.color,
                          }}
                        >
                          {tierInfo.short}
                        </span>

                        <span className="mono" style={{ color: "#ffffff", fontWeight: 700, fontSize: "14px" }}>
                          {formatTime(r.time)}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Player PFP + Name + Relative Time */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", fontSize: "12px", color: "var(--text-subtle)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                        {playerAvatar ? (
                          <img
                            src={playerAvatar}
                            alt=""
                            style={{
                              width: "18px",
                              height: "18px",
                              borderRadius: "4px",
                              border: "1px solid var(--border)",
                              objectFit: "cover",
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "18px",
                              height: "18px",
                              borderRadius: "4px",
                              background: "var(--panel)",
                              border: "1px solid var(--border)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "9px",
                              fontWeight: 700,
                              fontFamily: "monospace",
                            }}
                          >
                            KZ
                          </div>
                        )}

                        {cleanPlayerId ? (
                          <Link
                            className={`player-link ${isCurrentUser ? "current-user-link" : ""}`}
                            href={`/profile/${cleanPlayerId}?mode=${mode}`}
                            style={{ fontSize: "12px", fontWeight: 600 }}
                          >
                            {r.player?.name || cleanPlayerId}
                            {isCurrentUser && <span className="current-user-tag" style={{ marginLeft: "4px" }}>YOU</span>}
                          </Link>
                        ) : (
                          <span>{r.player?.name || "Unknown"}</span>
                        )}
                      </div>

                      <span className="mono" style={{ fontSize: "11px", color: "var(--text-subtle)", flexShrink: 0 }}>
                        {relativeTime}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {recentWrs.length === 0 && (
              <div className="empty-state">No recent records available.</div>
            )}
          </div>
        </div>

        {/* Right Column: Top Players by Rating (Matching Cards) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: "2px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em", color: "#ffffff" }}>
              Top Players by Rating
            </h3>
            <Link
              href={`/leaderboards?mode=${mode}`}
              style={{ fontSize: "11px", color: "var(--text-subtle)", textDecoration: "none", fontFamily: "monospace" }}
              className="hover-underline"
            >
              Full Leaderboard →
            </Link>
          </div>

          {/* Individual Compact Player Cards Stack */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {topPointsPlayers.slice(0, 7).map((player, idx) => {
              const rankNum = idx + 1;
              const rankColor = getRankColor(rankNum);
              const rating = mode === "classic" ? player.ckz_rating : player.vnl_rating;
              const rankInfo = getPlayerRank(rating);
              const cleanPlayerId = sanitizeSteamId(player.id);
              const playerAvatar = avatarsMap[cleanPlayerId];
              const isCurrentUser =
                !!userSteamId &&
                cleanPlayerId.toLowerCase() === userSteamId.toLowerCase();

              const formattedPlayerPoints =
                rating != null
                  ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(rating))
                  : "0";

              return (
                <div
                  key={player.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "12px 16px",
                    background: isCurrentUser ? "rgba(95, 153, 217, 0.08)" : "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    transition: "border-color 0.15s ease",
                  }}
                  className="hover-card-border"
                >
                  {/* Left Side: Player Steam Avatar (Clean Square) */}
                  <Link
                    href={`/profile/${cleanPlayerId}?mode=${mode}`}
                    style={{
                      width: "54px",
                      height: "54px",
                      flexShrink: 0,
                      borderRadius: "6px",
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      background: "var(--panel)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {playerAvatar ? (
                      <img
                        src={playerAvatar}
                        alt={player.name || cleanPlayerId}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "var(--text-subtle)",
                          fontFamily: "monospace",
                        }}
                      >
                        KZ
                      </span>
                    )}
                  </Link>

                  {/* Right Side: Player Info Stack */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0, flex: 1 }}>
                    {/* Top Row: Rank Number + Player Name + Rank Badge */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <span
                          className="mono"
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: isCurrentUser ? "var(--user-blue)" : rankColor,
                          }}
                        >
                          {formatRank(rankNum)}
                        </span>

                        <Link
                          className={`player-link ${isCurrentUser ? "current-user-link" : ""}`}
                          href={`/profile/${cleanPlayerId}?mode=${mode}`}
                          style={{
                            color: "#ffffff",
                            fontWeight: 700,
                            fontSize: "14px",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {player.name || cleanPlayerId}
                          {isCurrentUser && <span className="current-user-tag" style={{ marginLeft: "6px" }}>YOU</span>}
                        </Link>
                      </div>

                      <span
                        className="tag-badge"
                        style={{
                          padding: "2px 7px",
                          fontSize: "10px",
                          fontWeight: 800,
                          color: "#ffffff",
                          backgroundColor: rankInfo.color,
                          borderColor: rankInfo.color,
                          flexShrink: 0,
                        }}
                      >
                        {rankInfo.name}
                      </span>
                    </div>

                    {/* Bottom Row: Rating Points + Mode */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", fontSize: "12px", color: "var(--text-subtle)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          className="mono"
                          style={{
                            fontSize: "13px",
                            fontFamily: "ui-monospace, monospace",
                            color: rankInfo.color,
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{formattedPlayerPoints}</span>{" "}
                          <span style={{ fontWeight: 400, opacity: 0.9, color: rankInfo.color }}>Points</span>
                        </span>
                      </div>

                      <span className="mono" style={{ fontSize: "11px", color: "var(--text-subtle)", flexShrink: 0 }}>
                        {mode === "classic" ? "CKZ" : "VNL"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {topPointsPlayers.length === 0 && (
              <div className="empty-state">No players available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
