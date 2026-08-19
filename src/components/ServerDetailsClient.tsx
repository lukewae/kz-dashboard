"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { KzMap, KzServer } from "@/lib/types";
import { getMapImageUrl, getTierInfo, resolveCanonicalTier } from "@/lib/format";
import { useFavoriteServers } from "@/lib/useFavoriteServers";
import { sfx } from "@/lib/sfx";
import { CountryFlag, normalizeServerGeo } from "@/components/ServersBrowser";

interface ServerPlayer {
  index: number;
  name: string;
  score: number;
  duration: number; // seconds
}

interface ServerPlayersResponse {
  available: boolean;
  count?: number;
  namedCount?: number;
  anonymousCount?: number;
  isNamesHidden?: boolean;
  players?: ServerPlayer[];
  fallbackCount?: number;
  maxPlayers?: number;
  error?: string;
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function ServerDetailsClient({
  server,
  mapData,
  initialPlayerData,
}: {
  server: KzServer;
  mapData: KzMap | null;
  initialPlayerData?: ServerPlayersResponse | null;
}) {
  const [playerData, setPlayerData] = useState<ServerPlayersResponse | null>(() => initialPlayerData || null);
  const [isLoading, setIsLoading] = useState(!initialPlayerData);
  const [isCopied, setIsCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  const { isFavorite, toggleFavorite } = useFavoriteServers();
  const isFav = isFavorite(server.id);

  const currentMap = server.a2s_info?.current_map || "Unknown Map";
  const apiNumPlayers = server.a2s_info?.num_players ?? 0;
  const isNamesHidden = !!playerData?.isNamesHidden;
  const hasNamedPlayers = !!(playerData?.available && playerData.players && playerData.players.length > 0);

  // Accurate active players calculation
  const numPlayers = playerData?.available
    ? (playerData.namedCount && playerData.namedCount > 0
        ? playerData.namedCount
        : (playerData.anonymousCount && playerData.anonymousCount > 0 ? playerData.anonymousCount : 0))
    : (playerData?.fallbackCount ?? apiNumPlayers);

  const maxPlayers = playerData?.maxPlayers ?? server.a2s_info?.max_players ?? 0;
  const isOnline = !!server.a2s_info;

  const geo = normalizeServerGeo(server);
  const mapImageSrc = imageError ? "/kz-logo.png" : getMapImageUrl(currentMap);

  // Map Tier
  const mainCourse = mapData?.courses?.find((c) => c.name.toLowerCase() === "main") || mapData?.courses?.[0];
  const canonicalTier = resolveCanonicalTier(
    mainCourse?.filters?.classic?.nub_tier || mainCourse?.filters?.vanilla?.nub_tier,
    mainCourse?.filters?.classic?.pro_tier || mainCourse?.filters?.vanilla?.pro_tier
  );
  const tierInfo = getTierInfo(canonicalTier);

  // Fetch player list from API
  const fetchPlayers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/cs2kz/servers/${server.id}/players`);
      if (res.ok) {
        const data: ServerPlayersResponse = await res.json();
        setPlayerData(data);
      } else {
        setPlayerData({
          available: false,
          fallbackCount: server.a2s_info?.num_players || 0,
          maxPlayers: server.a2s_info?.max_players || 0,
        });
      }
    } catch {
      setPlayerData({
        available: false,
        fallbackCount: server.a2s_info?.num_players || 0,
        maxPlayers: server.a2s_info?.max_players || 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialPlayerData) {
      fetchPlayers();
    }
    const interval = setInterval(fetchPlayers, 20000); // 20s auto refresh
    return () => clearInterval(interval);
  }, [server.id]);

  const handleCopy = () => {
    sfx.playTick();
    const connectCmd = `connect ${server.host}:${server.port}`;
    navigator.clipboard.writeText(connectCmd).then(() => {
      sfx.playTick();
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Header Banner & Quick Actions */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: "280px", flex: 1 }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              flexShrink: 0,
            }}
          >
            <CountryFlag countryCode={geo.countryCode} size="md" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#ffffff",
                  letterSpacing: "-0.01em",
                  margin: 0,
                }}
              >
                {server.name}
              </h2>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11px",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: isOnline ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  color: isOnline ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)",
                  border: `1px solid ${isOnline ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: isOnline ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)",
                    boxShadow: isOnline ? "0 0 6px rgba(34, 197, 94, 0.6)" : "none",
                  }}
                />
                {isOnline ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px", color: "var(--text-subtle)", fontFamily: "monospace" }}>
              <span>{server.host}:{server.port}</span>
              <span>•</span>
              <span>{geo.region || geo.countryCode}</span>
              {server.owner?.name && (
                <>
                  <span>•</span>
                  <span>Host: {server.owner.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              sfx.playTick();
              toggleFavorite(server.id);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 14px",
              background: isFav ? "rgba(234, 179, 8, 0.15)" : "var(--panel)",
              border: `1px solid ${isFav ? "rgba(234, 179, 8, 0.4)" : "var(--border)"}`,
              borderRadius: "var(--radius-sm)",
              color: isFav ? "rgb(250, 204, 21)" : "var(--text-muted)",
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <span>{isFav ? "★" : "☆"}</span>
            <span>{isFav ? "FAVORITED" : "FAVORITE"}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 14px",
              background: isCopied ? "rgba(34, 197, 94, 0.2)" : "var(--panel)",
              border: `1px solid ${isCopied ? "rgba(34, 197, 94, 0.5)" : "var(--border)"}`,
              borderRadius: "var(--radius-sm)",
              color: isCopied ? "rgb(34, 197, 94)" : "var(--text)",
              fontSize: "12.5px",
              fontWeight: 700,
              fontFamily: "monospace",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <span>{isCopied ? "✓" : "📋"}</span>
            <span>{isCopied ? "COPIED CONNECT!" : "COPY IP"}</span>
          </button>

          <a
            href={`steam://connect/${server.host}:${server.port}`}
            onClick={() => sfx.playTick()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 16px",
              background: "var(--user-blue)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "var(--radius-sm)",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              textDecoration: "none",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(95, 153, 217, 0.25)",
              transition: "all 0.15s ease",
            }}
          >
            <span>▶</span>
            <span>CONNECT</span>
          </a>
        </div>
      </div>

      {/* 2. Main 2-Column Grid: Map Hero Artwork (Left) & Player List / Telemetry (Right) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Current Map Details & Artwork */}
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
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: "11px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-subtle)", fontWeight: 700 }}>
              CURRENT ROTATING MAP
            </span>

            {tierInfo && tierInfo.level > 0 && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#ffffff",
                  backgroundColor: tierInfo.color,
                  padding: "2px 8px",
                  borderRadius: "3px",
                  fontFamily: "monospace",
                }}
              >
                {tierInfo.short} · {tierInfo.label}
              </span>
            )}
          </div>

          {/* 16:9 Map Artwork Preview */}
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              background: "#0a0a0d",
              position: "relative",
              overflow: "hidden",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <img
              src={mapImageSrc}
              alt={currentMap}
              style={{
                width: "100%",
                height: "100%",
                objectFit: imageError ? "contain" : "cover",
                padding: imageError ? "24px" : 0,
                display: "block",
              }}
              onError={() => setImageError(true)}
            />

            <div
              style={{
                position: "absolute",
                bottom: 0,
                insetInline: 0,
                background: "linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, transparent 100%)",
                padding: "20px 20px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>
                {currentMap}
              </span>
              {mapData?.mappers && mapData.mappers.length > 0 && (
                <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.7)" }}>
                  by {mapData.mappers.map((a: { name: string }) => a.name).join(", ")}
                </span>
              )}
            </div>
          </div>

          {/* Map Meta Footer */}
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              background: "var(--panel)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-subtle)" }}>Map Status:</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#ffffff" }}>
                {mapData ? "Official Global Map" : (server.a2s_info?.current_map_info?.global_state || "Workshop Map")}
              </span>
            </div>

            {mapData && (
              <Link
                href={`/maps/${encodeURIComponent(mapData.name)}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  textDecoration: "none",
                  transition: "background 0.15s ease",
                }}
              >
                <span>View Map Records</span>
                <span>↗</span>
              </Link>
            )}
          </div>
        </div>

        {/* Right Column: Live Player List & Server Metrics */}
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
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-subtle)", fontWeight: 700 }}>
                LIVE CONNECTED PLAYERS
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontFamily: "monospace",
                  fontWeight: 700,
                  color: numPlayers > 0 ? "rgb(34, 197, 94)" : "var(--text-subtle)",
                }}
              >
                ({numPlayers} / {maxPlayers || "—"})
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                sfx.playTick();
                fetchPlayers();
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "12px",
                fontFamily: "monospace",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
              title="Refresh player list"
            >
              <span>↻</span>
              <span>{isLoading ? "REFRESHING..." : "REFRESH"}</span>
            </button>
          </div>

          {/* Player List Table, Hidden Names Notice, Fallback, or Empty */}
          <div style={{ minHeight: "260px", display: "flex", flexDirection: "column" }}>
            {isLoading && !playerData ? (
              <div
                style={{
                  padding: "48px 24px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  color: "var(--text-subtle)",
                  textAlign: "center",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    border: "2px solid var(--border)",
                    borderTopColor: "var(--user-blue)",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <div style={{ fontSize: "12.5px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                  Querying live server players...
                </div>
              </div>
            ) : hasNamedPlayers ? (
              <div style={{ overflowX: "auto" }}>
                <table className="records-table" style={{ width: "100%", margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: "45px", textAlign: "center" }}>#</th>
                      <th>Player Name</th>
                      <th style={{ textAlign: "right" }}>Duration</th>
                      <th style={{ textAlign: "right", width: "70px" }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerData!.players!.map((p, idx) => (
                      <tr key={`${p.index}-${p.name}-${idx}`}>
                        <td className="mono" style={{ textAlign: "center", color: "var(--text-subtle)", fontSize: "12px" }}>
                          {idx + 1}
                        </td>
                        <td style={{ fontWeight: 600, color: "#ffffff" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgb(34, 197, 94)" }} />
                            <span>{p.name}</span>
                          </span>
                        </td>
                        <td className="mono" style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "12px" }}>
                          {formatDuration(p.duration)}
                        </td>
                        <td className="mono" style={{ textAlign: "right", color: "var(--text-subtle)", fontSize: "12px" }}>
                          {p.score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : isNamesHidden || (playerData?.available && (playerData.anonymousCount ?? 0) > 0) ? (
              /* Server hides / restricts live player names via privacy settings (e.g. DatHost host_players_show) */
              <div
                style={{
                  padding: "48px 24px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  color: "var(--text-subtle)",
                  textAlign: "center",
                  flex: 1,
                }}
              >
                <div style={{ fontSize: "28px" }}>🔒</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>
                  {numPlayers} {numPlayers === 1 ? "Player" : "Players"} Active
                </div>
                <div style={{ fontSize: "12.5px", maxWidth: "340px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  This server hides or restricts public player names in query responses. Active players can be viewed directly in-game on the scoreboard.
                </div>
              </div>
            ) : numPlayers === 0 ? (
              <div
                style={{
                  padding: "48px 24px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  color: "var(--text-subtle)",
                  textAlign: "center",
                  flex: 1,
                }}
              >
                <div style={{ fontSize: "28px" }}>👥</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>No Active Players</div>
                <div style={{ fontSize: "12.5px", maxWidth: "260px" }}>
                  This server is currently empty. Connect and be the first to set a time on {currentMap}!
                </div>
              </div>
            ) : (
              /* Fallback state when server refuses connection or UDP query timed out */
              <div
                style={{
                  padding: "48px 24px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  color: "var(--text-subtle)",
                  textAlign: "center",
                  flex: 1,
                }}
              >
                <div style={{ fontSize: "28px" }}>📡</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>
                  {numPlayers} {numPlayers === 1 ? "Player" : "Players"} Connected
                </div>
                <div style={{ fontSize: "12.5px", maxWidth: "340px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Live player details could not be retrieved (server query timed out or refused connection). Check in-game via console or scoreboard.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
