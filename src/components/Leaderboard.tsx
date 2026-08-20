"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDifference, formatRank, formatTime, getRankColor, sanitizeSteamId } from "@/lib/format";
import { KzRecord, Leaderboard, Mode } from "@/lib/types";
import { useUserSteamId } from "@/lib/useUserSteamId";

export function LeaderboardTable({
  records,
  type,
  mode = "classic",
}: {
  records: KzRecord[];
  type: Leaderboard;
  mode?: Mode;
}) {
  const { userSteamId } = useUserSteamId();
  const wr = records[0]?.time;
  const [avatarsMap, setAvatarsMap] = useState<Record<string, string>>({});

  const visibleSteamIds = useMemo(() => {
    const ids = new Set<string>();
    records.slice(0, 100).forEach((r) => {
      if (r.player?.id) ids.add(sanitizeSteamId(r.player.id));
    });
    return Array.from(ids);
  }, [records]);

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
        console.error("Failed to fetch leaderboard steam avatars:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [visibleSteamIds]);

  return (
    <div className="table-container">
      <table className="records-table">
        <thead>
          <tr>
            <th style={{ width: "65px" }}>Rank</th>
            <th style={{ minWidth: "190px" }}>Player</th>
            <th style={{ width: "105px" }}>Time</th>
            <th style={{ width: "90px" }}>Δ WR</th>
            <th style={{ width: "85px" }}>Teleports</th>
            <th style={{ width: "90px" }}>Points</th>
            <th style={{ width: "210px" }}>Server</th>
            <th style={{ textAlign: "center", width: "65px", paddingRight: "20px" }}>Replay</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => {
            const rank = type === "pro" ? r.pro_rank : r.nub_rank;
            const rankNum = rank != null ? rank : (i + 1);
            const rankColor = getRankColor(rankNum);
            const points = type === "pro" ? r.pro_points : r.nub_points;
            const cleanPlayerId = r.player?.id ? sanitizeSteamId(r.player.id) : null;
            const isCurrentUser =
              !!userSteamId &&
              !!cleanPlayerId &&
              cleanPlayerId.toLowerCase() === userSteamId.toLowerCase();
            const avatarUrl = cleanPlayerId ? avatarsMap[cleanPlayerId] : null;
            const displayName = r.player?.name ?? cleanPlayerId ?? "Unknown";

            return (
              <tr
                className={`${i === 0 ? "top-1" : ""} ${isCurrentUser ? "current-user-row" : ""}`}
                key={r.id}
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
                  {cleanPlayerId ? (
                    <Link
                      className={`player-link ${isCurrentUser ? "current-user-link" : ""}`}
                      href={`/profile/${cleanPlayerId}?mode=${mode}&leaderboard=${type}`}
                      title={`View ${displayName}'s profile`}
                      style={{ display: "inline-flex", alignItems: "center", gap: "9px" }}
                    >
                      <div
                        style={{
                          width: "24px",
                          height: "24px",
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
                          <span style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--text-subtle)", fontWeight: 700 }}>
                            {displayName.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <strong style={{ color: isCurrentUser ? "var(--user-blue)" : undefined, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}>
                        {displayName}
                      </strong>
                      {isCurrentUser && (
                        <span className="current-user-tag">
                          YOU
                        </span>
                      )}
                    </Link>
                  ) : (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "9px" }}>
                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "4px",
                          background: "#18181c",
                          border: "1px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                          color: "var(--text-subtle)",
                        }}
                      >
                        KZ
                      </div>
                      <strong>{displayName}</strong>
                    </div>
                  )}
                </td>
                <td className="mono" style={{ color: isCurrentUser ? "var(--user-blue)" : "#ffffff", fontWeight: 600 }}>
                  {formatTime(r.time)}
                </td>
                <td className="mono" style={{ color: i === 0 ? "var(--text)" : isCurrentUser ? "var(--user-blue)" : "var(--text-subtle)" }}>
                  {formatDifference(r.time, wr)}
                </td>
                <td className="mono">{r.teleports ?? "—"}</td>
                <td className="mono">
                  {points != null
                    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(points)
                    : "—"}
                </td>
                <td style={{ maxWidth: "210px", overflow: "hidden", textOverflow: "ellipsis", fontSize: "12.5px" }}>
                  {r.server?.name ?? "—"}
                </td>
                <td style={{ textAlign: "center", width: "65px", paddingRight: "20px" }}>
                  {r.replay_available ? (
                    <a
                      href={`https://demo.kzcomp.com/watch?ids=${encodeURIComponent(r.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="replay-watch-btn"
                      title="Watch 3D Web Replay ↗"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M23 7l-7 5 7 5V7z" fill="currentColor" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                    </a>
                  ) : (
                    <span style={{ color: "var(--text-subtle)", fontSize: "12px" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {records.length === 0 && (
        <div className="empty-state">
          No records currently recorded for this course and mode.
        </div>
      )}
    </div>
  );
}
