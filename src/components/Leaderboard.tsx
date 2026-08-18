"use client";

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

  return (
    <div className="table-container">
      <table className="records-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Time</th>
            <th>Δ WR</th>
            <th>Teleports</th>
            <th>Points</th>
            <th>Server</th>
            <th>Replay</th>
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
                      title={`View ${r.player?.name}'s profile`}
                    >
                      <strong style={{ color: isCurrentUser ? "var(--user-blue)" : undefined }}>
                        {r.player?.name ?? "Unknown"}
                      </strong>
                      {isCurrentUser && (
                        <span className="current-user-tag">
                          YOU
                        </span>
                      )}
                    </Link>
                  ) : (
                    <strong>{r.player?.name ?? "Unknown"}</strong>
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
                <td style={{ maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.server?.name ?? "—"}
                </td>
                <td className="mono">
                  {r.replay_available ? (
                    <span style={{ color: "var(--text)", fontSize: "11px" }}>YES</span>
                  ) : (
                    <span style={{ color: "var(--text-subtle)", fontSize: "11px" }}>NO</span>
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
