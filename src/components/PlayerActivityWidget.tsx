"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  formatRank,
  formatRelativeTime,
  formatTime,
  getMapImageUrl,
  getRankColor,
  getRecordTimestamp,
} from "@/lib/format";
import { KzRecord, Mode } from "@/lib/types";

interface MonthDayCell {
  dayNum: number;
  dateStr: string;
  count: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  intensity: number; // 0 to 4
}

export function PlayerActivityWidget({
  userRecords,
  userSteamId,
  mode,
  mapImageMap,
}: {
  userRecords: KzRecord[];
  userSteamId: string | null;
  mode: Mode;
  mapImageMap: Record<string, string>;
}) {
  const [currentMonthOffset, setCurrentMonthOffset] = useState<number>(0);
  const [hoveredDay, setHoveredDay] = useState<{ label: string; count: number } | null>(null);

  // Group all user completions by YYYY-MM-DD
  const dailyCounts = useMemo(() => {
    const map = new Map<string, number>();
    userRecords.forEach((r) => {
      const d = getRecordTimestamp(r.id);
      if (!d || isNaN(d.getTime())) return;
      const key = d.toISOString().split("T")[0]; // YYYY-MM-DD
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [userRecords]);

  // Calculate Active Playing Streak
  const activeStreak = useMemo(() => {
    const today = new Date();
    let streak = 0;
    const checkDate = new Date(today);
    const todayKey = checkDate.toISOString().split("T")[0];
    const todayPlayed = (dailyCounts.get(todayKey) || 0) > 0;

    if (!todayPlayed) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const key = checkDate.toISOString().split("T")[0];
      const count = dailyCounts.get(key) || 0;
      if (count > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [dailyCounts]);

  // Compute Active Month Matrix (e.g. August 2026 with 1..31 days + padding)
  const { monthLabel, calendarGrid, monthTotalRuns } = useMemo(() => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + currentMonthOffset);

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const monthName = targetDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    // Days in month
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    // First day of month (0 = Mon ... 6 = Sun)
    const firstDayRaw = new Date(year, month, 1).getDay();
    const firstDayIndex = (firstDayRaw + 6) % 7;

    const todayStr = new Date().toISOString().split("T")[0];
    const grid: (MonthDayCell | null)[] = [];
    let totalRuns = 0;

    // Leading empty padding cells
    for (let i = 0; i < firstDayIndex; i++) {
      grid.push(null);
    }

    // Month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const dateKey = dayDate.toISOString().split("T")[0];
      const count = dailyCounts.get(dateKey) || 0;
      totalRuns += count;

      let intensity = 0;
      if (count === 1) intensity = 1;
      else if (count === 2 || count === 3) intensity = 2;
      else if (count >= 4 && count <= 6) intensity = 3;
      else if (count >= 7) intensity = 4;

      grid.push({
        dayNum: day,
        dateStr: dateKey,
        count,
        isToday: dateKey === todayStr,
        isCurrentMonth: true,
        intensity,
      });
    }

    // Always pad to 42 cells (6 weeks x 7 days) to ensure identical fixed height across all months
    while (grid.length < 42) {
      grid.push(null);
    }

    return {
      monthLabel: monthName,
      calendarGrid: grid,
      monthTotalRuns: totalRuns,
    };
  }, [currentMonthOffset, dailyCounts]);

  // Extract Top Point Runs in the Last 30 Days (7 runs that fit evenly)
  const recentTopRuns = useMemo(() => {
    if (userRecords.length === 0) return [];

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const runsLast30d = userRecords.filter((r) => {
      const t = getRecordTimestamp(r.id)?.getTime() || 0;
      return t >= thirtyDaysAgo;
    });

    const pool = runsLast30d.length >= 3 ? runsLast30d : userRecords;

    // Sort by highest points descending
    const sorted = [...pool].sort((a, b) => {
      const ptsA = Math.max(a.pro_points || 0, a.nub_points || 0);
      const ptsB = Math.max(b.pro_points || 0, b.nub_points || 0);
      return ptsB - ptsA;
    });

    return sorted.slice(0, 7);
  }, [userRecords]);

  // Intensity color styling
  const getIntensityBg = (intensity: number) => {
    switch (intensity) {
      case 1:
        return "rgba(95, 153, 217, 0.35)";
      case 2:
        return "rgba(95, 153, 217, 0.6)";
      case 3:
        return "rgba(95, 153, 217, 0.85)";
      case 4:
        return "var(--user-blue)";
      default:
        return "rgba(255, 255, 255, 0.04)";
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "14px",
        height: "100%",
        alignItems: "stretch",
      }}
    >
      {/* 1. Left Widget: Activity Calendar Card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          justifyContent: "space-between",
          height: "100%",
        }}
      >
        {/* Header Row: Title + Streak on Left, Month Navigation on Right */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <h3 style={{ fontSize: "13.5px", fontWeight: 800, margin: 0, color: "#ffffff", letterSpacing: "0.02em" }}>
              Activity Calendar
            </h3>
            {userSteamId && activeStreak > 0 && (
              <span
                className="tag-badge"
                style={{
                  fontSize: "8.5px",
                  fontWeight: 800,
                  color: "rgb(251, 146, 60)",
                  borderColor: "rgba(251, 146, 60, 0.4)",
                  background: "rgba(251, 146, 60, 0.08)",
                  padding: "1px 5px",
                }}
              >
                🔥 {activeStreak}d
              </span>
            )}
          </div>

          {/* Compact Month Switcher (‹ Aug 2026 ›) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "1px 4px",
            }}
          >
            <button
              type="button"
              onClick={() => setCurrentMonthOffset((prev) => prev - 1)}
              className="btn-minimal"
              style={{ padding: "0px 4px", fontSize: "10px", fontWeight: 700 }}
              title="Previous Month"
            >
              ‹
            </button>
            <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#ffffff", fontFamily: "monospace", padding: "0 2px" }}>
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonthOffset((prev) => prev + 1)}
              disabled={currentMonthOffset >= 0}
              className="btn-minimal"
              style={{
                padding: "0px 4px",
                fontSize: "10px",
                fontWeight: 700,
                opacity: currentMonthOffset >= 0 ? 0.3 : 1,
                cursor: currentMonthOffset >= 0 ? "not-allowed" : "pointer",
              }}
              title="Next Month"
            >
              ›
            </button>
          </div>
        </div>

        {/* 7-Column Day of Week Header */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", textAlign: "center" }}>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} style={{ fontSize: "9px", color: "var(--text-subtle)", fontFamily: "monospace", fontWeight: 700 }}>
              {d}
            </span>
          ))}
        </div>

        {/* Month Cubes Grid (7 Columns x 6 Rows Fixed Matrix) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gridTemplateRows: "repeat(6, 1fr)",
            gap: "3.5px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "6px",
            flex: 1,
            minHeight: "0px",
          }}
        >
          {calendarGrid.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} style={{ minHeight: "0px" }} />;
            }

            const hasRuns = cell.count > 0;
            return (
              <div
                key={cell.dateStr}
                onMouseEnter={() =>
                  setHoveredDay({
                    label: `${monthLabel} ${cell.dayNum}`,
                    count: cell.count,
                  })
                }
                onMouseLeave={() => setHoveredDay(null)}
                style={{
                  borderRadius: "3.5px",
                  background: getIntensityBg(cell.intensity),
                  border: cell.isToday ? "1.5px solid #ffffff" : "1px solid rgba(255, 255, 255, 0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "9.5px",
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: hasRuns ? 800 : 500,
                  color: hasRuns ? "#ffffff" : "var(--text-subtle)",
                  opacity: hasRuns ? 1 : 0.55,
                  cursor: "pointer",
                  transition: "transform 0.1s ease, border-color 0.1s ease",
                  boxShadow: cell.intensity > 2 ? "0 0 8px rgba(95, 153, 217, 0.4)" : "none",
                  minHeight: "0px",
                }}
              >
                {cell.dayNum}
              </div>
            );
          })}
        </div>

        {/* Calendar Caption & Stats */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10.5px", color: "var(--text-subtle)", fontFamily: "monospace", minHeight: "16px" }}>
          <span>
            {hoveredDay ? (
              <strong style={{ color: "#ffffff" }}>
                {hoveredDay.label}: {hoveredDay.count} run{hoveredDay.count === 1 ? "" : "s"}
              </strong>
            ) : (
              <>
                <strong style={{ color: "#ffffff" }}>{monthTotalRuns}</strong> runs this month
              </>
            )}
          </span>

          {currentMonthOffset !== 0 && (
            <button
              type="button"
              onClick={() => setCurrentMonthOffset(0)}
              style={{
                background: "none",
                border: "none",
                color: "var(--user-blue)",
                cursor: "pointer",
                fontSize: "10px",
                padding: 0,
                fontFamily: "monospace",
              }}
            >
              Today ↺
            </button>
          )}
        </div>
      </div>

      {/* 2. Right Widget: Top Runs (Last 30 Days) Card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          justifyContent: "space-between",
          height: "100%",
        }}
      >
        {/* Header Row: Matched Height */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: "24px" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
            Top Runs (Last 30 Days)
          </span>
          {userSteamId && (
            <Link
              href={`/profile/${encodeURIComponent(userSteamId)}?mode=${mode}`}
              style={{ fontSize: "10.5px", color: "var(--user-blue)", textDecoration: "none", fontFamily: "monospace" }}
              className="hover-underline"
            >
              All Records →
            </Link>
          )}
        </div>

        {recentTopRuns.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, justifyContent: "space-between" }}>
            {recentTopRuns.map((r) => {
              const mapName = r.map?.name ?? "Unknown";
              const courseName = r.course?.name ?? "Main";
              const points = Math.round(Math.max(r.pro_points || 0, r.nub_points || 0));
              const rank = (r.teleports === 0 ? r.pro_rank : r.nub_rank) || r.nub_rank;
              const rankColor = getRankColor(rank);
              const rankLabel = formatRank(rank);
              const recordDate = getRecordTimestamp(r.id);
              const relTime = formatRelativeTime(recordDate);
              const mapImage = mapImageMap[mapName.toLowerCase()] || getMapImageUrl(mapName);
              const isPro = r.teleports === 0;

              return (
                <Link
                  key={r.id}
                  href={`/maps/${encodeURIComponent(mapName)}?course=${encodeURIComponent(courseName)}&mode=${mode}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "4px 8px",
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: "5px",
                    textDecoration: "none",
                    transition: "border-color 0.15s ease",
                  }}
                  className="hover-card-border"
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: "38px",
                      height: "23px",
                      borderRadius: "3px",
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      background: "#0d0d10",
                      flexShrink: 0,
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
                  </div>

                  {/* Info Stack */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}>
                        <span style={{ color: "#ffffff", fontWeight: 700, fontSize: "11.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {mapName}
                        </span>
                        <span
                          className={isPro ? "run-type-pro" : "run-type-tp"}
                          style={{ fontSize: "7px", padding: "0 3px", fontWeight: 800 }}
                        >
                          {isPro ? "PRO" : "TP"}
                        </span>
                      </div>

                      {/* Rank Badge + Days Ago with "-" Separator */}
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                        {rank != null && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontFamily: "ui-monospace, monospace",
                              fontWeight: 800,
                              color: rankColor,
                            }}
                          >
                            {rankLabel}
                          </span>
                        )}
                        <span style={{ fontSize: "9px", color: "var(--text-subtle)", fontFamily: "monospace" }}>
                          - {relTime}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "9.5px" }}>
                      <span style={{ color: "var(--text-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {courseName} · {formatTime(r.time)}
                      </span>
                      <span style={{ color: "rgb(251, 191, 36)", fontWeight: 700, fontFamily: "monospace" }}>
                        {points} pts
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: "16px 12px",
              textAlign: "center",
              color: "var(--text-subtle)",
              fontSize: "11.5px",
              background: "var(--panel)",
              borderRadius: "6px",
              border: "1px solid var(--border)",
            }}
          >
            {userSteamId ? "No completed records found for this mode." : "Enter your Steam ID to view your activity calendar & top runs."}
          </div>
        )}
      </div>
    </div>
  );
}
