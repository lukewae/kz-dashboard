"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatFullTimestamp, formatRank, formatRelativeTime, formatTime, getPlayerRank, getRankColor, getRecordTimestamp, getTierInfo, resolveCanonicalTier, TIER_CONFIG } from "@/lib/format";
import { KzMap, KzPlayer, KzRecord, Leaderboard, Mode, Tier } from "@/lib/types";

const TIERS_LIST: { level: number; key: Tier; short: string; label: string; color: string; rgb: string }[] = [
  { level: 1, key: "very-easy", short: "T1", label: "Very Easy", color: "rgb(134, 239, 172)", rgb: "134, 239, 172" },
  { level: 2, key: "easy", short: "T2", label: "Easy", color: "rgb(74, 222, 128)", rgb: "74, 222, 128" },
  { level: 3, key: "medium", short: "T3", label: "Medium", color: "rgb(234, 179, 8)", rgb: "234, 179, 8" },
  { level: 4, key: "advanced", short: "T4", label: "Advanced", color: "rgb(245, 158, 11)", rgb: "245, 158, 11" },
  { level: 5, key: "hard", short: "T5", label: "Hard", color: "rgb(234, 88, 12)", rgb: "234, 88, 12" },
  { level: 6, key: "very-hard", short: "T6", label: "Very Hard", color: "rgb(239, 68, 68)", rgb: "239, 68, 68" },
  { level: 7, key: "extreme", short: "T7", label: "Extreme", color: "rgb(220, 38, 38)", rgb: "220, 38, 38" },
  { level: 8, key: "death", short: "T8", label: "Death", color: "rgb(147, 51, 234)", rgb: "147, 51, 234" },
];

type SortColumn = "recent" | "rank" | "tier" | "points" | "time" | "map";

interface IncompleteCourseItem {
  id: string;
  mapName: string;
  courseName: string;
  tierKey: Tier | null;
  tierLevel: number;
  isRanked: boolean;
}

export function ProfileBrowser({
  player,
  records,
  allMaps,
  steamId,
  mode,
  leaderboard,
  overallRank,
  wrLeaderboardRank,
}: {
  player: KzPlayer | null;
  records: KzRecord[];
  allMaps: KzMap[];
  steamId: string;
  mode: Mode;
  leaderboard: Leaderboard;
  overallRank?: number | null;
  wrLeaderboardRank?: number | null;
}) {
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [rankedOnly, setRankedOnly] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"completed" | "incomplete">("completed");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("recent");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const rating = mode === "classic" ? player?.ckz_rating : player?.vnl_rating;
  const rankInfo = getPlayerRank(rating);

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

  // Compute Rank Milestones (respecting rankedOnly filter)
  const stats = useMemo(() => {
    let wrCount = 0;
    let top10Count = 0;
    let top20Count = 0;
    let top50Count = 0;

    records.forEach((r) => {
      const mapName = r.map?.name ?? "";
      const courseName = r.course?.name ?? "Main";
      const key = `${mapName.toLowerCase()}_${courseName.toLowerCase()}`;
      const isRanked = courseRankedMap[key] ?? true;

      if (rankedOnly && !isRanked) return;

      const isPro = r.teleports === 0;
      const rank =
        leaderboard === "pro"
          ? r.pro_rank ?? (isPro ? r.nub_rank : null)
          : r.nub_rank ?? r.pro_rank;

      if (rank != null && rank > 0) {
        if (rank === 1) wrCount++;
        else if (rank >= 2 && rank <= 10) top10Count++;
        else if (rank >= 11 && rank <= 20) top20Count++;
        else if (rank >= 21 && rank <= 50) top50Count++;
      }
    });

    return { wrCount, top10Count, top20Count, top50Count };
  }, [records, leaderboard, rankedOnly, courseRankedMap]);

  // Compute Total Available Ranked Courses per Tier from the Map Catalog for the active mode
  const totalTierCounts = useMemo<Record<number, number>>(() => {
    const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
    allMaps.forEach((m) => {
      if (m.state?.toLowerCase() === "invalid") return;
      m.courses?.forEach((c) => {
        const filt = c.filters?.[mode];
        const isRanked = filt?.state === "ranked";
        if (rankedOnly && !isRanked) return;

        const tierKey = resolveCanonicalTier(filt?.nub_tier, filt?.pro_tier);
        const lvl = getTierInfo(tierKey).level;
        if (lvl >= 1 && lvl <= 8) {
          totals[lvl] = (totals[lvl] || 0) + 1;
        }
      });
    });
    return totals;
  }, [allMaps, mode, rankedOnly]);

  // Compute User's Completed Records per Tier directly from their API runs
  const completedTierCounts = useMemo<Record<number, number>>(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
    records.forEach((r) => {
      const mapName = r.map?.name ?? "";
      const courseName = r.course?.name ?? "Main";
      const key = `${mapName.toLowerCase()}_${courseName.toLowerCase()}`;
      const isRanked = courseRankedMap[key] ?? true;

      if (rankedOnly && !isRanked) return;

      const tierKey = resolveCanonicalTier(r.course?.nub_tier, r.course?.pro_tier);
      const lvl = getTierInfo(tierKey).level;
      if (lvl >= 1 && lvl <= 8) {
        counts[lvl] = (counts[lvl] || 0) + 1;
      }
    });
    return counts;
  }, [records, rankedOnly, courseRankedMap]);

  // Overall Completion Summary
  const overallCompletion = useMemo(() => {
    let total = 0;
    let completed = 0;
    for (let i = 1; i <= 8; i++) {
      total += totalTierCounts[i] || 0;
      completed += completedTierCounts[i] || 0;
    }
    const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
    return { total, completed, percent };
  }, [totalTierCounts, completedTierCounts]);

  // Set of completed course keys: `${mapName}_${courseName}`
  const completedCourseKeys = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      const mapName = r.map?.name ?? "";
      const courseName = r.course?.name ?? "Main";
      set.add(`${mapName.toLowerCase()}_${courseName.toLowerCase()}`);
    });
    return set;
  }, [records]);

  // Full list of Incomplete Ranked Courses for this mode
  const incompleteCourses = useMemo<IncompleteCourseItem[]>(() => {
    const list: IncompleteCourseItem[] = [];
    allMaps.forEach((m) => {
      if (m.state?.toLowerCase() === "invalid") return;
      m.courses?.forEach((c) => {
        const filt = c.filters?.[mode];
        const isRanked = filt?.state === "ranked";
        if (rankedOnly && !isRanked) return;

        const tierKey = resolveCanonicalTier(filt?.nub_tier, filt?.pro_tier);
        const lvl = getTierInfo(tierKey).level;
        if (lvl >= 1 && lvl <= 8) {
          const key = `${m.name.toLowerCase()}_${c.name.toLowerCase()}`;
          if (!completedCourseKeys.has(key)) {
            list.push({
              id: `${m.name}_${c.name}`,
              mapName: m.name,
              courseName: c.name,
              tierKey,
              tierLevel: lvl,
              isRanked,
            });
          }
        }
      });
    });
    return list;
  }, [allMaps, mode, completedCourseKeys, rankedOnly]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      // Natural default direction: Recent, Points, and Tier default to desc (newest/highest first), others asc
      setSortDirection(col === "recent" || col === "points" || col === "tier" ? "desc" : "asc");
    }
  };

  // Filter & Sort Completed Records
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        const mapName = r.map?.name ?? "";
        const courseName = r.course?.name ?? "";
        const key = `${mapName.toLowerCase()}_${courseName.toLowerCase()}`;
        const isRanked = courseRankedMap[key] ?? true;

        if (rankedOnly && !isRanked) return false;

        const tierKey = resolveCanonicalTier(r.course?.nub_tier, r.course?.pro_tier);
        const tierLevel = getTierInfo(tierKey).level;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          if (!mapName.toLowerCase().includes(q) && !courseName.toLowerCase().includes(q)) {
            return false;
          }
        }

        // Selected Tier Bar filter
        if (selectedTier !== null) {
          if (tierLevel !== selectedTier) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const isProA = a.teleports === 0;
        const isProB = b.teleports === 0;
        const rankA =
          (leaderboard === "pro"
            ? a.pro_rank ?? (isProA ? a.nub_rank : null)
            : a.nub_rank ?? a.pro_rank) ?? 999999;
        const rankB =
          (leaderboard === "pro"
            ? b.pro_rank ?? (isProB ? b.nub_rank : null)
            : b.nub_rank ?? b.pro_rank) ?? 999999;
        const pointsA =
          (leaderboard === "pro"
            ? a.pro_points ?? (isProA ? a.nub_points : null)
            : a.nub_points ?? a.pro_points) ?? 0;
        const pointsB =
          (leaderboard === "pro"
            ? b.pro_points ?? (isProB ? b.nub_points : null)
            : b.nub_points ?? b.pro_points) ?? 0;
        const tierA = getTierInfo(resolveCanonicalTier(a.course?.nub_tier, a.course?.pro_tier)).level;
        const tierB = getTierInfo(resolveCanonicalTier(b.course?.nub_tier, b.course?.pro_tier)).level;

        const timeA = getRecordTimestamp(a.id)?.getTime() ?? 0;
        const timeB = getRecordTimestamp(b.id)?.getTime() ?? 0;

        let diff = 0;
        if (sortColumn === "recent") diff = timeA - timeB;
        else if (sortColumn === "rank") diff = rankA - rankB;
        else if (sortColumn === "points") diff = pointsA - pointsB;
        else if (sortColumn === "tier") diff = tierA - tierB;
        else if (sortColumn === "time") diff = a.time - b.time;
        else if (sortColumn === "map") diff = (a.map?.name ?? "").localeCompare(b.map?.name ?? "");

        return sortDirection === "asc" ? diff : -diff;
      });
  }, [records, selectedTier, searchQuery, sortColumn, sortDirection, leaderboard, rankedOnly, courseRankedMap]);

  // Filter & Sort Incomplete Courses
  const filteredIncomplete = useMemo(() => {
    return incompleteCourses
      .filter((item) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          if (!item.mapName.toLowerCase().includes(q) && !item.courseName.toLowerCase().includes(q)) {
            return false;
          }
        }

        // Selected Tier Bar filter
        if (selectedTier !== null) {
          if (item.tierLevel !== selectedTier) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortColumn === "tier") diff = a.tierLevel - b.tierLevel;
        else if (sortColumn === "map") diff = a.mapName.localeCompare(b.mapName);
        else diff = a.tierLevel - b.tierLevel || a.mapName.localeCompare(b.mapName);

        return sortDirection === "asc" ? diff : -diff;
      });
  }, [incompleteCourses, selectedTier, searchQuery, sortColumn, sortDirection]);

  return (
    <div>
      {/* 1. Mode, Leaderboard & Ranked Tracks Toggle Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "12px 18px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "center" }}>
          {/* Mode Toggle */}
          <div className="pill-group">
            <span className="pill-label">Mode:</span>
            <Link
              className={`pill-btn ${mode === "classic" ? "active" : ""}`}
              href={`/profile/${steamId}?mode=classic&leaderboard=${leaderboard}`}
            >
              CLASSIC (CKZ)
            </Link>
            <Link
              className={`pill-btn ${mode === "vanilla" ? "active" : ""}`}
              href={`/profile/${steamId}?mode=vanilla&leaderboard=${leaderboard}`}
            >
              VANILLA (VNL)
            </Link>
          </div>

          {/* Ranked Tracks Toggle */}
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

        {/* Leaderboard Toggle */}
        <div className="pill-group">
          <span className="pill-label">Leaderboard:</span>
          <Link
            className={`pill-btn ${leaderboard === "overall" ? "active" : ""}`}
            href={`/profile/${steamId}?mode=${mode}&leaderboard=overall`}
          >
            OVERALL
          </Link>
          <Link
            className={`pill-btn ${leaderboard === "pro" ? "active" : ""}`}
            href={`/profile/${steamId}?mode=${mode}&leaderboard=pro`}
          >
            PRO (NO TP)
          </Link>
        </div>
      </div>

      {/* 2. Split Overview Section: Tier Breakdown (Left) & 4 Stat Cards in 2x2 Grid (Right) */}
      <div
        className="profile-split-grid"
        style={{
          display: "grid",
          gap: "20px",
          alignItems: "start",
          marginBottom: "20px",
        }}
      >
        {/* Left Column: Tier Completion & Top Records Card */}
        <section className="tier-overview-card" style={{ margin: 0 }}>
          {/* Top records Header Row */}
          <div className="top-records-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <h2 className="overview-title" style={{ margin: 0 }}>Top records</h2>
                <div className="top-records-badges">
                  <div className="top-record-pill">
                    <span className="top-record-title">WRs:</span>
                    <span className="top-record-val wr">{stats.wrCount} 🥇</span>
                  </div>
                  <div className="top-record-pill">
                    <span className="top-record-title">Top 10:</span>
                    <span className="top-record-val top10">{stats.top10Count}</span>
                  </div>
                  <div className="top-record-pill">
                    <span className="top-record-title">Top 20:</span>
                    <span className="top-record-val top20">{stats.top20Count}</span>
                  </div>
                  <div className="top-record-pill">
                    <span className="top-record-title">Top 50:</span>
                    <span className="top-record-val top50">{stats.top50Count}</span>
                  </div>
                </div>
              </div>

              {/* Overall Completion Summary Badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: 600,
                  color: "#ffffff",
                }}
              >
                <span style={{ color: "var(--text-subtle)" }}>Completed:</span>
                <span>
                  {overallCompletion.completed}/{overallCompletion.total} ({overallCompletion.percent}%)
                </span>
              </div>
            </div>
          </div>

          {/* Always Visible Tier Completion Bars Section */}
          <div className="tier-completion-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "11px", fontFamily: "ui-monospace, monospace", textTransform: "uppercase", color: "var(--text-subtle)", letterSpacing: "0.06em", fontWeight: 700 }}>
                  Completion per tier {rankedOnly ? "(Ranked)" : "(All)"}
                </span>
                {selectedTier !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedTier(null)}
                    className="btn-minimal"
                    style={{ padding: "1px 6px", fontSize: "10px" }}
                  >
                    Show All
                  </button>
                )}
              </div>

              <div className="tier-bars-stack">
                {TIERS_LIST.map((t) => {
                  const total = totalTierCounts[t.level] || 0;
                  const completed = completedTierCounts[t.level] || 0;
                  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
                  const isSelected = selectedTier === t.level;

                  return (
                    <div
                      key={t.level}
                      className={`tier-bar-row ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedTier(isSelected ? null : t.level)}
                      title={`Filter by ${t.label} (Level ${t.level})`}
                    >
                      {/* Left Label */}
                      <span className="tier-bar-label" style={{ color: t.color }}>
                        {t.label}
                      </span>

                      {/* Middle Progress Bar */}
                      <div
                        className="tier-bar-track"
                        style={{
                          background: `rgba(${t.rgb}, 0.16)`,
                          border: `1px solid rgba(${t.rgb}, 0.28)`,
                        }}
                      >
                        <div
                          className="tier-bar-fill"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: t.color,
                          }}
                        />
                      </div>

                      {/* Right Counter */}
                      <span className="tier-bar-count mono">
                        {completed} / {total}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
        </section>

        {/* Right Column: 4 Info Summary Cards in 2x2 Grid (Stretching Evenly & Centered) */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gridTemplateRows: "repeat(2, 1fr)",
            gap: "14px",
            height: "100%",
          }}
        >
          {/* Card 1: Rating Points */}
          <div className="stat-card">
            <span className="stat-label">
              {mode === "classic" ? "CKZ Rating Points" : "VNL Rating Points"}
            </span>
            <span className="stat-value">
              {rating != null
                ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(rating))
                : "—"}
            </span>
            <span
              className="tag-badge"
              style={{
                fontSize: "10px",
                fontWeight: 800,
                color: "#ffffff",
                backgroundColor: rankInfo.color,
                borderColor: rankInfo.color,
                padding: "2px 7px",
                marginTop: "2px",
              }}
            >
              {rankInfo.name}
            </span>
          </div>

          {/* Card 2: Completed Runs */}
          <div className="stat-card">
            <span className="stat-label">Completed Runs</span>
            <span className="stat-value">{filteredRecords.length}</span>
            <span style={{ fontSize: "11px", color: "var(--text-subtle)", fontFamily: "monospace" }}>
              {mode === "classic" ? "CKZ Tracks" : "VNL Tracks"}
            </span>
          </div>

          {/* Card 3: Overall Rating Rank */}
          <div className="stat-card">
            <span className="stat-label">Overall Rating Rank</span>
            <span className="stat-value" style={{ color: overallRank ? rankInfo.color : "var(--text-subtle)" }}>
              {overallRank ? `#${overallRank}` : "—"}
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-subtle)", fontFamily: "monospace" }}>
              Global Leaderboard
            </span>
          </div>

          {/* Card 4: WR Leaderboard Rank */}
          <div className="stat-card">
            <span className="stat-label">WR Leaderboard Rank</span>
            <span className="stat-value" style={{ color: wrLeaderboardRank ? "rgb(250, 204, 21)" : "var(--text-subtle)" }}>
              {wrLeaderboardRank ? `#${wrLeaderboardRank}` : "—"}
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-subtle)", fontFamily: "monospace" }}>
              {stats.wrCount > 0 ? `${stats.wrCount} World Records` : "No World Records"}
            </span>
          </div>
        </section>
      </div>

      {/* 4. Unified Table Card with Embedded Search & Controls Toolbar */}
      <div className="table-container">
        {/* Table Toolbar Header */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            padding: "14px 18px",
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {/* Left: View Mode Toggle & Active Filter Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div className="pill-group" style={{ margin: 0 }}>
              <button
                type="button"
                className={`pill-btn ${viewMode === "completed" ? "active" : ""}`}
                onClick={() => setViewMode("completed")}
                style={{ fontSize: "11px", padding: "4px 10px" }}
              >
                COMPLETED ({records.length})
              </button>
              <button
                type="button"
                className={`pill-btn ${viewMode === "incomplete" ? "active" : ""}`}
                onClick={() => setViewMode("incomplete")}
                style={{
                  fontSize: "11px",
                  padding: "4px 10px",
                  color: viewMode === "incomplete" ? "#ffffff" : "rgb(251, 146, 60)",
                  background: viewMode === "incomplete" ? "rgb(251, 146, 60)" : undefined,
                  borderColor: viewMode === "incomplete" ? "rgb(251, 146, 60)" : undefined,
                }}
              >
                INCOMPLETE ({incompleteCourses.length})
              </button>
            </div>

            {selectedTier !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  className="tag-badge"
                  style={{
                    backgroundColor: TIERS_LIST[selectedTier - 1]?.color,
                    borderColor: TIERS_LIST[selectedTier - 1]?.color,
                    color: "#ffffff",
                    padding: "2px 7px",
                    fontSize: "10px",
                    fontWeight: 800,
                  }}
                >
                  {TIERS_LIST[selectedTier - 1]?.short} · {TIERS_LIST[selectedTier - 1]?.label.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTier(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-subtle)",
                    fontSize: "11px",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Clear
                </button>
              </div>
            )}

            <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--text-subtle)" }}>
              {viewMode === "completed"
                ? `${filteredRecords.length} RUNS`
                : `${filteredIncomplete.length} MISSING`}
            </span>
          </div>

          {/* Right: Embedded Search Field */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "240px", maxWidth: "340px", flex: 1 }}>
            <div style={{ position: "relative", width: "100%" }}>
              <input
                type="text"
                placeholder={viewMode === "completed" ? "Search completed map or course..." : "Search missing map or course..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sidebar-user-input"
                style={{
                  padding: "7px 12px",
                  fontSize: "12px",
                  width: "100%",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(255, 255, 255, 0.04)",
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
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
        {viewMode === "completed" ? (
          <table className="records-table">
            <thead>
              <tr>
                <th className="sortable-th" onClick={() => handleSort("recent")} title="Sort by Date Set">
                  <div className="th-content">
                    <span>Recent</span>
                    <span className={`sort-arrow ${sortColumn === "recent" ? "active" : ""}`}>
                      {sortColumn === "recent" ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}
                    </span>
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort("rank")} title="Sort by Rank">
                  <div className="th-content">
                    <span>Rank</span>
                    <span className={`sort-arrow ${sortColumn === "rank" ? "active" : ""}`}>
                      {sortColumn === "rank" ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}
                    </span>
                  </div>
                </th>
                <th>Type</th>
                <th className="sortable-th" onClick={() => handleSort("map")} title="Sort by Map Name">
                  <div className="th-content">
                    <span>Map</span>
                    <span className={`sort-arrow ${sortColumn === "map" ? "active" : ""}`}>
                      {sortColumn === "map" ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}
                    </span>
                  </div>
                </th>
                <th>Course</th>
                <th className="sortable-th" onClick={() => handleSort("tier")} title="Sort by Tier Difficulty">
                  <div className="th-content">
                    <span>Tier</span>
                    <span className={`sort-arrow ${sortColumn === "tier" ? "active" : ""}`}>
                      {sortColumn === "tier" ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}
                    </span>
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort("time")} title="Sort by Time">
                  <div className="th-content">
                    <span>Time</span>
                    <span className={`sort-arrow ${sortColumn === "time" ? "active" : ""}`}>
                      {sortColumn === "time" ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}
                    </span>
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort("points")} title="Sort by Points">
                  <div className="th-content">
                    <span>Points</span>
                    <span className={`sort-arrow ${sortColumn === "points" ? "active" : ""}`}>
                      {sortColumn === "points" ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}
                    </span>
                  </div>
                </th>
                <th>TPs</th>
                <th>Server</th>
                <th>Replay</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => {
                const mapName = r.map?.name ?? "Unknown Map";
                const courseName = r.course?.name ?? "Main";
                const isPro = r.teleports === 0;
                const tierKey = resolveCanonicalTier(r.course?.nub_tier, r.course?.pro_tier);
                const tierInfo = getTierInfo(tierKey);
                const rank =
                  leaderboard === "pro"
                    ? r.pro_rank ?? (isPro ? r.nub_rank : null)
                    : r.nub_rank ?? r.pro_rank;
                const points =
                  leaderboard === "pro"
                    ? r.pro_points ?? (isPro ? r.nub_points : null)
                    : r.nub_points ?? r.pro_points;
                const rankColor = getRankColor(rank);
                const recordDate = getRecordTimestamp(r.id);

                return (
                  <tr key={r.id}>
                    <td
                      className="mono"
                      style={{ fontSize: "12px", color: "var(--text-subtle)", whiteSpace: "nowrap" }}
                      title={formatFullTimestamp(recordDate)}
                      suppressHydrationWarning
                    >
                      {formatRelativeTime(recordDate)}
                    </td>
                    <td
                      className="mono"
                      style={{
                        color: rankColor,
                        fontWeight: rank && rank <= 3 ? 700 : 500,
                      }}
                    >
                      {formatRank(rank)}
                    </td>
                    <td>
                      {isPro ? (
                        <span className="run-type-pro">PRO</span>
                      ) : (
                        <span className="run-type-tp">TP</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/maps/${encodeURIComponent(mapName)}?course=${encodeURIComponent(courseName)}&mode=${mode}&leaderboard=${leaderboard}`}
                        style={{ color: "#ffffff", fontWeight: 600, textDecoration: "underline" }}
                      >
                        {mapName}
                      </Link>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontWeight: 500 }}>{courseName}</td>
                    <td>
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
                        {tierInfo.short !== "—" ? `${tierInfo.short} · ${tierInfo.label}` : "—"}
                      </span>
                    </td>
                    <td className="mono" style={{ color: "#ffffff", fontWeight: 600 }}>
                      {formatTime(r.time)}
                    </td>
                    <td className="mono">
                      {points != null
                        ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(points)
                        : "—"}
                    </td>
                    <td className="mono" style={{ color: "var(--text-subtle)" }}>{r.teleports ?? 0}</td>
                    <td style={{ maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text-subtle)", fontSize: "12px" }}>
                      {r.server?.name ?? "—"}
                    </td>
                    <td style={{ textAlign: "center", width: "50px" }}>
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
        ) : (
          <table className="records-table">
            <thead>
              <tr>
                <th>Status</th>
                <th className="sortable-th" onClick={() => handleSort("map")} title="Sort by Map Name">
                  <div className="th-content">
                    <span>Map</span>
                    <span className={`sort-arrow ${sortColumn === "map" ? "active" : ""}`}>
                      {sortColumn === "map" ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}
                    </span>
                  </div>
                </th>
                <th>Course</th>
                <th className="sortable-th" onClick={() => handleSort("tier")} title="Sort by Tier Difficulty">
                  <div className="th-content">
                    <span>Tier</span>
                    <span className={`sort-arrow ${sortColumn === "tier" ? "active" : ""}`}>
                      {sortColumn === "tier" ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}
                    </span>
                  </div>
                </th>
                <th>Leaderboard</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncomplete.map((item) => {
                const tierInfo = getTierInfo(item.tierKey);
                return (
                  <tr key={item.id}>
                    <td>
                      <span
                        className="tag-badge"
                        style={{
                          color: "#ffffff",
                          borderColor: "rgb(205, 45, 45)",
                          backgroundColor: "rgb(205, 45, 45)",
                          fontWeight: 800,
                          fontSize: "10px",
                          padding: "2px 7px",
                        }}
                      >
                        INCOMPLETE
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/maps/${encodeURIComponent(item.mapName)}?course=${encodeURIComponent(item.courseName)}&mode=${mode}&leaderboard=${leaderboard}`}
                        style={{ color: "#ffffff", fontWeight: 600, textDecoration: "underline" }}
                      >
                        {item.mapName}
                      </Link>
                    </td>
                    <td>{item.courseName}</td>
                    <td>
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
                        {tierInfo.short !== "—" ? `${tierInfo.short} · ${tierInfo.label}` : "—"}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/maps/${encodeURIComponent(item.mapName)}?course=${encodeURIComponent(item.courseName)}&mode=${mode}&leaderboard=${leaderboard}`}
                        className="btn-minimal"
                        style={{ padding: "3px 8px", fontSize: "11px", display: "inline-block" }}
                      >
                        View Map Leaderboard ↗
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {((viewMode === "completed" && filteredRecords.length === 0) ||
          (viewMode === "incomplete" && filteredIncomplete.length === 0)) && (
          <div className="empty-state">
            {viewMode === "completed"
              ? "No completed runs found matching the selected filters."
              : "All maps in this tier/search filter have been completed!"}
          </div>
        )}
      </div>
    </div>
  );
}
