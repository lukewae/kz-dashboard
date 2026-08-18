"use client";

import { useMemo, useState } from "react";
import { KzMap, Mode, Tier } from "@/lib/types";
import { MapCard } from "@/components/MapCard";
import { getTierInfo, resolveCanonicalTier, TIER_CONFIG } from "@/lib/format";

const TIERS_CONFIG: { level: number; key: Tier; short: string; label: string; color: string }[] = [
  { level: 1, key: "very-easy", short: "T1", label: "Very Easy", color: TIER_CONFIG["very-easy"].color },
  { level: 2, key: "easy", short: "T2", label: "Easy", color: TIER_CONFIG["easy"].color },
  { level: 3, key: "medium", short: "T3", label: "Medium", color: TIER_CONFIG["medium"].color },
  { level: 4, key: "advanced", short: "T4", label: "Advanced", color: TIER_CONFIG["advanced"].color },
  { level: 5, key: "hard", short: "T5", label: "Hard", color: TIER_CONFIG["hard"].color },
  { level: 6, key: "very-hard", short: "T6", label: "Very Hard", color: TIER_CONFIG["very-hard"].color },
  { level: 7, key: "extreme", short: "T7", label: "Extreme", color: TIER_CONFIG["extreme"].color },
  { level: 8, key: "death", short: "T8", label: "Death", color: TIER_CONFIG["death"].color },
];

export function MapsBrowser({ maps }: { maps: KzMap[] }) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("classic");
  const [sortBy, setSortBy] = useState<string>("name-asc");
  const [selectedTiers, setSelectedTiers] = useState<Set<number>>(new Set());
  // Unranked tracks hidden by default
  const [includeUnranked, setIncludeUnranked] = useState<boolean>(false);

  // Filter out invalid maps
  const activeMaps = useMemo(() => {
    return maps.filter((m) => m.state?.toLowerCase() !== "invalid");
  }, [maps]);

  // Compute tier mapping for every course across all maps for the active mode
  // In Vanilla mode, exclude impossible/unfeasible (Tier 10 / Tier 9) tracks
  const mapCoursesData = useMemo(() => {
    return activeMaps
      .map((map) => {
        const courses = map.courses ?? [];
        const coursesMeta = courses
          .map((c) => {
            const filt = c.filters?.[mode];
            const isRanked = filt?.state?.toLowerCase() === "ranked";
            const rawNub = filt?.nub_tier?.toLowerCase();
            const rawPro = filt?.pro_tier?.toLowerCase();
            const isImpossible =
              rawNub === "impossible" ||
              rawPro === "impossible" ||
              rawNub === "unfeasible" ||
              rawPro === "unfeasible" ||
              filt?.state?.toLowerCase() === "impossible";

            const tierKey = resolveCanonicalTier(filt?.nub_tier, filt?.pro_tier);
            const tierInfo = getTierInfo(tierKey);
            return {
              course: c,
              isRanked,
              isImpossible,
              tierLevel: tierInfo.level,
            };
          })
          .filter((cm) => {
            // In Vanilla mode, completely hide impossible/unfeasible tracks
            if (mode === "vanilla" && cm.isImpossible) return false;
            return true;
          });

        const rankedTiers = coursesMeta
          .filter((cm) => cm.isRanked && cm.tierLevel > 0)
          .map((cm) => cm.tierLevel);

        const minTier = rankedTiers.length > 0 ? Math.min(...rankedTiers) : 0;
        const maxTier = rankedTiers.length > 0 ? Math.max(...rankedTiers) : 0;

        return {
          map,
          coursesMeta,
          rankedTiers,
          minTier,
          maxTier,
          hasRanked: rankedTiers.length > 0,
          hasPossible: coursesMeta.length > 0,
        };
      })
      // Only include maps that have at least one valid possible course in this mode
      .filter((item) => item.hasPossible);
  }, [activeMaps, mode]);

  // Calculate accurate ranked course counts for each tier (matches Profile exactly)
  const tierCourseCounts = useMemo(() => {
    const counts: Record<number | "unranked", number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      unranked: 0,
    };

    mapCoursesData.forEach((item) => {
      item.coursesMeta.forEach((cm) => {
        if (cm.tierLevel === 0 || !cm.isRanked) {
          counts["unranked"] = (counts["unranked"] || 0) + 1;
        } else {
          const lvl = Math.min(8, Math.max(1, cm.tierLevel));
          counts[lvl] = (counts[lvl] || 0) + 1;
        }
      });
    });

    return counts;
  }, [mapCoursesData]);

  // Toggle single tier multi-select
  const toggleTier = (level: number) => {
    setSelectedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  // Clear / Select All Tiers
  const selectAllTiers = () => {
    setSelectedTiers(new Set());
  };

  // Filter and sort maps (1 card per map, containing all its tracks)
  const filteredMaps = useMemo(() => {
    const query = search.trim().toLowerCase();

    return mapCoursesData
      .filter((item) => {
        // If unranked tracks are hidden, map must have at least one ranked course
        if (!includeUnranked && !item.hasRanked) {
          return false;
        }

        // Search filter (map name, track name, or mapper)
        if (query) {
          const matchMap = item.map.name.toLowerCase().includes(query);
          const matchCourse = item.coursesMeta.some((cm) =>
            cm.course.name.toLowerCase().includes(query)
          );
          const matchMapper = (item.map.mappers ?? []).some((m) =>
            m.name.toLowerCase().includes(query)
          );
          if (!matchMap && !matchCourse && !matchMapper) return false;
        }

        // Tier filter (matches if ANY active course on the map satisfies selected tiers)
        if (selectedTiers.size === 0) {
          return true;
        }

        const hasMatchingRankedCourse = item.coursesMeta.some(
          (cm) => cm.isRanked && selectedTiers.has(cm.tierLevel)
        );

        if (hasMatchingRankedCourse) {
          return true;
        }

        // Unranked course check if unranked tier (0) is selected
        if (includeUnranked && selectedTiers.has(0)) {
          return item.coursesMeta.some((cm) => !cm.isRanked || cm.tierLevel === 0);
        }

        return false;
      })
      .sort((a, b) => {
        if (sortBy === "name-asc") {
          return a.map.name.localeCompare(b.map.name);
        }
        if (sortBy === "name-desc") {
          return b.map.name.localeCompare(a.map.name);
        }
        if (sortBy === "tier-asc") {
          const tierA = a.minTier || 99;
          const tierB = b.minTier || 99;
          return tierA - tierB || a.map.name.localeCompare(b.map.name);
        }
        if (sortBy === "tier-desc") {
          const tierA = a.maxTier || -1;
          const tierB = b.maxTier || -1;
          return tierB - tierA || a.map.name.localeCompare(b.map.name);
        }
        if (sortBy === "courses") {
          return (b.map.courses?.length ?? 0) - (a.map.courses?.length ?? 0);
        }
        return 0;
      })
      .map((item) => item.map);
  }, [mapCoursesData, search, sortBy, selectedTiers, includeUnranked]);

  const hasActiveFilters = search !== "" || selectedTiers.size > 0 || includeUnranked;

  // Total ranked tracks in this mode
  const totalRankedTracks = useMemo(() => {
    return Object.entries(tierCourseCounts).reduce(
      (acc, [k, v]) => (k !== "unranked" ? acc + v : acc),
      0
    );
  }, [tierCourseCounts]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 1. Filter Toolbar */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
        }}
      >
        {/* Top Controls Row: Search + Mode Switch + Sort */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Search Box */}
          <div style={{ flex: 1, minWidth: "240px" }}>
            <input
              type="text"
              className="sidebar-user-input"
              style={{ width: "100%", padding: "8px 14px", fontSize: "12px" }}
              placeholder="Search by map name, course track, or mapper..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "center" }}>
            {/* Mode Switch */}
            <div className="pill-group">
              <span className="pill-label">Mode:</span>
              <button
                type="button"
                className={`pill-btn ${mode === "classic" ? "active" : ""}`}
                onClick={() => setMode("classic")}
              >
                CLASSIC (CKZ)
              </button>
              <button
                type="button"
                className={`pill-btn ${mode === "vanilla" ? "active" : ""}`}
                onClick={() => setMode("vanilla")}
              >
                VANILLA (VNL)
              </button>
            </div>

            {/* Sort Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="pill-label">Sort:</span>
              <select
                className="select-control"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: "6px 10px", fontSize: "12px" }}
              >
                <option value="name-asc">Name (A → Z)</option>
                <option value="name-desc">Name (Z → A)</option>
                <option value="tier-asc">Tier (Lowest First)</option>
                <option value="tier-desc">Tier (Highest First)</option>
                <option value="courses">Most Courses</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bottom Controls Row: Clean Multi-Select Tier Filter Buttons & Accessible Unranked Toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            paddingTop: "12px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <span className="pill-label" style={{ marginRight: "4px" }}>
            Tiers:
          </span>

          {/* ALL MAPS Button */}
          <button
            type="button"
            className={`pill-btn ${selectedTiers.size === 0 ? "active" : ""}`}
            onClick={selectAllTiers}
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            ALL TIERS
          </button>

          {/* Individual Multi-Select Tier Buttons */}
          {TIERS_CONFIG.map((t) => {
            const isSelected = selectedTiers.has(t.level);
            const count = tierCourseCounts[t.level] || 0;

            // In Vanilla mode, if a tier has 0 playable maps, dim it
            const isDisabled = count === 0;

            return (
              <button
                key={t.level}
                type="button"
                onClick={() => !isDisabled && toggleTier(t.level)}
                disabled={isDisabled}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "11px",
                  fontWeight: 700,
                  border: `1px solid ${isSelected ? t.color : "var(--border)"}`,
                  background: isSelected ? t.color : "rgba(255, 255, 255, 0.04)",
                  color: isDisabled ? "var(--text-subtle)" : "#ffffff",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  opacity: isDisabled ? 0.35 : 1,
                  transition: "all 0.15s ease",
                }}
              >
                <span>{t.short}</span>
                <span
                  style={{
                    fontSize: "9.5px",
                    fontWeight: 800,
                    opacity: isSelected ? 1 : 0.75,
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  ({count})
                </span>
              </button>
            );
          })}

          {/* Accessible Unranked Toggle Switch */}
          {tierCourseCounts.unranked > 0 && (
            <button
              type="button"
              role="switch"
              aria-checked={includeUnranked}
              onClick={() => setIncludeUnranked((prev) => !prev)}
              className="pill-btn"
              title={includeUnranked ? "Click to hide unranked tracks" : "Click to show unranked tracks"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                padding: "4px 10px",
                fontWeight: 600,
                background: includeUnranked ? "rgba(95, 153, 217, 0.2)" : "rgba(255, 255, 255, 0.04)",
                borderColor: includeUnranked ? "var(--user-blue)" : "var(--border)",
                color: includeUnranked ? "#ffffff" : "var(--text-subtle)",
                transition: "all 0.15s ease",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: includeUnranked ? "var(--user-blue)" : "rgba(255, 255, 255, 0.2)",
                  boxShadow: includeUnranked ? "0 0 6px rgba(95, 153, 217, 0.8)" : "none",
                }}
              />
              <span>{includeUnranked ? "Unranked Visible" : "Include Unranked"}</span>
              <span style={{ fontSize: "9.5px", opacity: 0.75, fontFamily: "ui-monospace, monospace" }}>
                ({tierCourseCounts.unranked})
              </span>
            </button>
          )}

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                selectAllTiers();
                setIncludeUnranked(false);
              }}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                color: "var(--user-blue)",
                fontSize: "11px",
                fontFamily: "monospace",
                cursor: "pointer",
                padding: "4px 6px",
              }}
            >
              Reset Filters ↺
            </button>
          )}
        </div>
      </div>

      {/* 2. Results Count Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
        <span style={{ fontSize: "12px", color: "var(--text-subtle)", fontFamily: "monospace" }}>
          Showing <strong style={{ color: "#ffffff" }}>{filteredMaps.length}</strong> maps ({totalRankedTracks} ranked {mode === "vanilla" ? "Vanilla" : "Classic"} tracks)
        </span>
      </div>

      {/* 3. Unified Maps Grid (1 card per map with mini course boxes) */}
      {filteredMaps.length > 0 ? (
        <div className="maps-grid">
          {filteredMaps.map((map) => (
            <MapCard
              key={map.id}
              map={map}
              mode={mode}
              highlightTiers={selectedTiers}
              includeUnranked={includeUnranked}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "48px 24px",
            textAlign: "center",
            color: "var(--text-subtle)",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔍</div>
          <h4 style={{ fontSize: "15px", color: "#ffffff", margin: "0 0 6px 0" }}>No maps matched your filter</h4>
          <p style={{ fontSize: "12px", margin: 0 }}>
            Try clearing selected tiers or adjusting your search keyword.
          </p>
          <button
            type="button"
            className="btn-minimal"
            onClick={() => {
              setSearch("");
              selectAllTiers();
              setIncludeUnranked(false);
            }}
            style={{ marginTop: "14px", padding: "6px 14px", fontSize: "12px" }}
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}
