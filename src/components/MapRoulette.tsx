"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getMapImageUrl, getTierInfo, resolveCanonicalTier, TIER_CONFIG } from "@/lib/format";
import { KzMap, KzRecord, Mode, Tier } from "@/lib/types";
import { sfx } from "@/lib/sfx";

interface MapCandidate {
  id: string;
  mapName: string;
  courseName: string;
  tierKey: Tier | null;
  tierLevel: number;
}

export function MapRoulette({
  allMaps,
  mode,
  userRecords,
  userSteamId,
  mapImageMap,
}: {
  allMaps: KzMap[];
  mode: Mode;
  userRecords: KzRecord[];
  userSteamId: string | null;
  mapImageMap: Record<string, string>;
}) {
  const [poolType, setPoolType] = useState<"incomplete" | "all">("incomplete");
  const [minTier, setMinTier] = useState<number>(1);
  const [maxTier, setMaxTier] = useState<number>(8);
  const [runType, setRunType] = useState<"pro" | "tp">("tp");
  const [isRolling, setIsRolling] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<MapCandidate | null>(null);
  const [copied, setCopied] = useState(false);

  const rollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Set of completed courses filtered by runType (PRO: teleports === 0, TP/Overall: any completion)
  const completedKeysForRunType = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    userRecords.forEach((r) => {
      if (runType === "pro" && r.teleports !== 0) {
        return;
      }
      const mapName = r.map?.name ?? "";
      const courseName = r.course?.name ?? "Main";
      set.add(`${mapName.toLowerCase()}_${courseName.toLowerCase()}`);
    });
    return set;
  }, [userRecords, runType]);

  // All Ranked Courses Candidate Pool
  const allRankedCourses = useMemo<MapCandidate[]>(() => {
    const list: MapCandidate[] = [];
    allMaps.forEach((m) => {
      if (m.state?.toLowerCase() === "invalid") return;
      m.courses?.forEach((c) => {
        const filt = c.filters?.[mode];
        if (filt?.state !== "ranked") return;

        const tierKey = resolveCanonicalTier(filt?.nub_tier, filt?.pro_tier);
        const lvl = getTierInfo(tierKey).level;
        list.push({
          id: `${m.name}_${c.name}`,
          mapName: m.name,
          courseName: c.name,
          tierKey,
          tierLevel: lvl,
        });
      });
    });
    return list;
  }, [allMaps, mode]);

  // Incomplete Courses for the selected runType (PRO vs TP)
  const incompleteCoursesForRunType = useMemo<MapCandidate[]>(() => {
    return allRankedCourses.filter((c) => {
      const key = `${c.mapName.toLowerCase()}_${c.courseName.toLowerCase()}`;
      return !completedKeysForRunType.has(key);
    });
  }, [allRankedCourses, completedKeysForRunType]);

  // Filter candidate pool based on active selection (poolType + 1-8 tier range)
  const eligibleCandidates = useMemo(() => {
    const source = poolType === "incomplete" && userSteamId ? incompleteCoursesForRunType : allRankedCourses;
    return source.filter((c) => c.tierLevel >= minTier && c.tierLevel <= maxTier);
  }, [poolType, userSteamId, incompleteCoursesForRunType, allRankedCourses, minTier, maxTier]);

  // Set default preview when pool or runType changes
  useEffect(() => {
    if (eligibleCandidates.length > 0) {
      if (!selectedCandidate || !eligibleCandidates.some((c) => c.id === selectedCandidate.id)) {
        setSelectedCandidate(eligibleCandidates[0]);
      }
    } else {
      setSelectedCandidate(null);
    }
  }, [eligibleCandidates, selectedCandidate]);

  // Fast, punchy roll animation (~0.6s) with subtle chill ticks
  const handleRoll = () => {
    if (isRolling || eligibleCandidates.length === 0) return;

    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    setIsRolling(true);

    let step = 0;
    const totalSteps = 14;
    let delay = 30;

    const tick = () => {
      const randomIndex = Math.floor(Math.random() * eligibleCandidates.length);
      setSelectedCandidate(eligibleCandidates[randomIndex]);
      sfx.playTick();

      step++;
      if (step < totalSteps) {
        delay += 4.5;
        rollTimeoutRef.current = setTimeout(tick, delay);
      } else {
        setIsRolling(false);
        sfx.playSettle();
      }
    };

    tick();
  };

  // Copy /nominate <mapname>
  const handleCopyNominate = async () => {
    if (!selectedCandidate) return;
    try {
      await navigator.clipboard.writeText(`/nominate ${selectedCandidate.mapName}`);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy nomination:", err);
    }
  };

  // Drag / Click handlers for 1-8 Tier Range Bar
  const getLevelFromPointer = (clientX: number): number => {
    if (!trackRef.current) return 1;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * 7) + 1; // Maps 0..1 to 1..8
  };

  const handlePointerDownThumb = (e: React.PointerEvent, isMin: boolean) => {
    if (isRolling) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const level = getLevelFromPointer(moveEvent.clientX);
      if (isMin) {
        setMinTier(Math.min(level, maxTier));
      } else {
        setMaxTier(Math.max(level, minTier));
      }
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (isRolling) return;
    const clicked = getLevelFromPointer(e.clientX);
    const distToMin = Math.abs(clicked - minTier);
    const distToMax = Math.abs(clicked - maxTier);

    if (distToMin <= distToMax) {
      setMinTier(Math.min(clicked, maxTier));
    } else {
      setMaxTier(Math.max(clicked, minTier));
    }
  };

  const currentTierInfo = selectedCandidate ? getTierInfo(selectedCandidate.tierKey) : null;
  const currentMapImage = selectedCandidate
    ? mapImageMap[selectedCandidate.mapName.toLowerCase()] || getMapImageUrl(selectedCandidate.mapName)
    : null;

  // Percentage for Range Highlight & Thumb Positions
  const minPercent = ((minTier - 1) / 7) * 100;
  const maxPercent = ((maxTier - 1) / 7) * 100;

  // Accurate Tier Gradient spanning the precise 8 Tiers
  // T1: 0% (Light Green) -> T2: 14.28% (Dark Green) -> T3: 28.57% (Amber) -> T4: 42.86% (Orange)
  // T5: 57.14% (Dark Orange) -> T6: 71.43% (Red) -> T7: 85.71% (Crimson) -> T8: 100% (Royal Purple)
  const tierSpectrumGradient = `linear-gradient(90deg, 
    ${TIER_CONFIG["very-easy"].color} 0%, 
    ${TIER_CONFIG["easy"].color} 14.285%, 
    ${TIER_CONFIG["medium"].color} 28.571%, 
    ${TIER_CONFIG["advanced"].color} 42.857%, 
    ${TIER_CONFIG["hard"].color} 57.143%, 
    ${TIER_CONFIG["very-hard"].color} 71.428%, 
    ${TIER_CONFIG["extreme"].color} 85.714%, 
    ${TIER_CONFIG["death"].color} 100%)`;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        height: "100%",
        justifyContent: "space-between",
      }}
    >
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          minHeight: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 style={{ fontSize: "13.5px", fontWeight: 800, margin: 0, color: "#ffffff", letterSpacing: "0.02em" }}>
            Map Roulette
          </h3>
          <span
            className="tag-badge"
            style={{
              fontSize: "8.5px",
              fontWeight: 800,
              color: "var(--text-subtle)",
              borderColor: "var(--border)",
              background: "rgba(255, 255, 255, 0.04)",
              padding: "1px 6px",
            }}
          >
            PRACTICE PICKER
          </span>
        </div>

        {/* Filter Controls Stack */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Target Mode: TP on Left, PRO on Right */}
          <div className="pill-group" style={{ margin: 0 }}>
            <button
              type="button"
              className={`pill-btn ${runType === "tp" ? "active" : ""}`}
              onClick={() => setRunType("tp")}
              disabled={isRolling}
              style={{
                fontSize: "10.5px",
                padding: "2.5px 9px",
                color: runType === "tp" ? "#ffffff" : undefined,
                background: runType === "tp" ? "rgb(208, 135, 0)" : undefined,
              }}
            >
              TP
            </button>
            <button
              type="button"
              className={`pill-btn ${runType === "pro" ? "active" : ""}`}
              onClick={() => setRunType("pro")}
              disabled={isRolling}
              style={{
                fontSize: "10.5px",
                padding: "2.5px 9px",
                color: runType === "pro" ? "#ffffff" : undefined,
                background: runType === "pro" ? "rgb(21, 93, 252)" : undefined,
              }}
            >
              PRO
            </button>
          </div>

          {/* Pool Toggle */}
          <div className="pill-group" style={{ margin: 0 }}>
            {userSteamId && (
              <button
                type="button"
                className={`pill-btn ${poolType === "incomplete" ? "active" : ""}`}
                onClick={() => setPoolType("incomplete")}
                disabled={isRolling}
                style={{ fontSize: "10.5px", padding: "2.5px 9px" }}
              >
                Incomplete ({incompleteCoursesForRunType.length})
              </button>
            )}
            <button
              type="button"
              className={`pill-btn ${poolType === "all" ? "active" : ""}`}
              onClick={() => setPoolType("all")}
              disabled={isRolling}
              style={{ fontSize: "10.5px", padding: "2.5px 9px" }}
            >
              All ({allRankedCourses.length})
            </button>
          </div>
        </div>
      </div>

      {/* 2. Accurate 1-8 Tier Range Bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "10.5px", color: "var(--text-subtle)", fontFamily: "monospace", textTransform: "uppercase" }}>
            Tier Range: <strong style={{ color: "#ffffff" }}>T{minTier} — T{maxTier}</strong> {minTier === 1 && maxTier === 8 && "(All Tiers)"}
          </span>
          {/* Quick Range Reset */}
          {(minTier !== 1 || maxTier !== 8) && (
            <button
              type="button"
              onClick={() => {
                setMinTier(1);
                setMaxTier(8);
              }}
              style={{
                fontSize: "10px",
                fontFamily: "monospace",
                color: "var(--user-blue)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Reset to All (T1-T8) ↺
            </button>
          )}
        </div>

        {/* Interactive Slider Track Container */}
        <div style={{ padding: "6px 8px 0px 8px" }}>
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            style={{
              position: "relative",
              height: "8px",
              background: tierSpectrumGradient,
              borderRadius: "4px",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            {/* Left Inactive Dimmer (0% to minPercent) */}
            {minPercent > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  width: `${minPercent}%`,
                  top: 0,
                  bottom: 0,
                  background: "rgba(10, 10, 13, 0.85)",
                  borderRadius: "4px 0 0 4px",
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Right Inactive Dimmer (maxPercent to 100%) */}
            {maxPercent < 100 && (
              <div
                style={{
                  position: "absolute",
                  left: `${maxPercent}%`,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  background: "rgba(10, 10, 13, 0.85)",
                  borderRadius: "0 4px 4px 0",
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Min Thumb */}
            <div
              onPointerDown={(e) => handlePointerDownThumb(e, true)}
              style={{
                position: "absolute",
                left: `${minPercent}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: "#ffffff",
                border: "2px solid #18181c",
                boxShadow: "0 2px 8px rgba(0,0,0,0.8)",
                cursor: "grab",
                zIndex: 3,
              }}
              title={`Min Tier: T${minTier}`}
            />

            {/* Max Thumb */}
            <div
              onPointerDown={(e) => handlePointerDownThumb(e, false)}
              style={{
                position: "absolute",
                left: `${maxPercent}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: "#ffffff",
                border: "2px solid #18181c",
                boxShadow: "0 2px 8px rgba(0,0,0,0.8)",
                cursor: "grab",
                zIndex: 4,
              }}
              title={`Max Tier: T${maxTier}`}
            />
          </div>

          {/* Tick Labels Perfectly Aligned with Exact Percentages */}
          <div style={{ position: "relative", height: "18px", marginTop: "6px" }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((lvl) => {
              const percent = ((lvl - 1) / 7) * 100;
              const inRange = lvl >= minTier && lvl <= maxTier;
              return (
                <span
                  key={lvl}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (lvl < minTier) setMinTier(lvl);
                    else if (lvl > maxTier) setMaxTier(lvl);
                    else {
                      setMinTier(lvl);
                      setMaxTier(lvl);
                    }
                  }}
                  style={{
                    position: "absolute",
                    left: `${percent}%`,
                    transform: "translateX(-50%)",
                    color: inRange ? "#ffffff" : "var(--text-subtle)",
                    opacity: inRange ? 1 : 0.4,
                    fontSize: "10.5px",
                    fontFamily: "ui-monospace, monospace",
                    fontWeight: 800,
                    cursor: "pointer",
                    userSelect: "none",
                    padding: "1px 3px",
                    transition: "color 0.15s ease, opacity 0.15s ease",
                  }}
                >
                  T{lvl}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Scaled-Up Output Card (Fills container cleanly with zero dead space) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "22px",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "18px 22px",
          flex: 1,
          alignContent: "stretch",
        }}
      >
        {/* Left: Scaled-Up Map Thumbnail (16:9 ratio fill) */}
        <div
          style={{
            position: "relative",
            width: "280px",
            height: "158px",
            borderRadius: "10px",
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "#0d0d10",
            flexShrink: 0,
          }}
        >
          {currentMapImage && (
            <img
              src={currentMapImage}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: isRolling ? "brightness(0.7) blur(0.5px)" : "brightness(0.9)",
                transform: isRolling ? "scale(1.05)" : "scale(1)",
                transition: "transform 0.15s ease, filter 0.15s ease",
              }}
              onError={(e) => {
                if (selectedCandidate) {
                  (e.currentTarget as HTMLImageElement).src = getMapImageUrl(selectedCandidate.mapName);
                }
              }}
            />
          )}

          {/* Badges Overlaid on Thumbnail */}
          {selectedCandidate && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                left: "10px",
                right: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                pointerEvents: "none",
              }}
            >
              <span
                className={runType === "pro" ? "run-type-pro" : "run-type-tp"}
                style={{ fontSize: "11px", padding: "3px 9px", fontWeight: 800 }}
              >
                {runType.toUpperCase()}
              </span>

              {currentTierInfo && (
                <span
                  className="tag-badge"
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#ffffff",
                    backgroundColor: currentTierInfo.color,
                    borderColor: currentTierInfo.color,
                    padding: "3px 9px",
                  }}
                >
                  {currentTierInfo.short} · {currentTierInfo.label.toUpperCase()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Scaled-Up Map Details & Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1, minWidth: 0, justifyContent: "center" }}>
          {selectedCandidate ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
              <h4
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  margin: 0,
                  color: "#ffffff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  letterSpacing: "-0.015em",
                }}
              >
                {selectedCandidate.mapName}
              </h4>
              <span style={{ fontSize: "14.5px", color: "var(--text-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Course: <strong style={{ color: "#ffffff", fontWeight: 600 }}>{selectedCandidate.courseName}</strong>
              </span>
              <span style={{ fontSize: "12.5px", color: "var(--text-subtle)", fontFamily: "monospace" }}>
                {eligibleCandidates.length} eligible maps ({runType.toUpperCase()})
              </span>
            </div>
          ) : (
            <div style={{ color: "var(--text-subtle)", fontSize: "13px" }}>
              No maps match your selected tier range (T{minTier} - T{maxTier}).
            </div>
          )}

          {/* Scaled Action Buttons (Fit side-by-side in a single clean row) */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "nowrap", marginTop: "4px" }}>
            <button
              type="button"
              onClick={handleRoll}
              disabled={isRolling || eligibleCandidates.length === 0}
              className="btn-minimal"
              style={{
                background: isRolling ? "rgba(95, 153, 217, 0.4)" : "var(--user-blue)",
                color: "#ffffff",
                borderColor: "var(--user-blue)",
                fontWeight: 800,
                padding: "6.5px 13px",
                borderRadius: "5px",
                fontSize: "11.5px",
                whiteSpace: "nowrap",
                cursor: isRolling || eligibleCandidates.length === 0 ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(95, 153, 217, 0.3)",
              }}
            >
              {isRolling ? "Rolling..." : "Roll Map"}
            </button>

            {selectedCandidate && (
              <button
                type="button"
                onClick={handleCopyNominate}
                disabled={isRolling}
                className="btn-minimal"
                title={`Copy /nominate ${selectedCandidate.mapName}`}
                style={{
                  background: copied ? "rgba(74, 222, 128, 0.15)" : "rgba(255, 255, 255, 0.06)",
                  color: copied ? "rgb(74, 222, 128)" : "#ffffff",
                  borderColor: copied ? "rgba(74, 222, 128, 0.4)" : "var(--border)",
                  fontWeight: 600,
                  padding: "6.5px 10px",
                  borderRadius: "5px",
                  fontSize: "11.5px",
                  whiteSpace: "nowrap",
                }}
              >
                {copied ? "✓ Copied" : "Copy /nominate"}
              </button>
            )}

            {selectedCandidate && !isRolling && (
              <Link
                href={`/maps/${encodeURIComponent(selectedCandidate.mapName)}?course=${encodeURIComponent(selectedCandidate.courseName)}&mode=${mode}&leaderboard=${runType === "pro" ? "pro" : "overall"}`}
                className="btn-minimal"
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  color: "var(--text)",
                  borderColor: "var(--border)",
                  fontWeight: 600,
                  padding: "6.5px 10px",
                  borderRadius: "5px",
                  fontSize: "11.5px",
                  whiteSpace: "nowrap",
                }}
              >
                Leaderboard ↗
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
