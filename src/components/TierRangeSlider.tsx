"use client";

import { useCallback, useRef } from "react";

const TIER_LEVELS = [
  { level: 1, key: "very-easy", short: "T1", label: "Very Easy" },
  { level: 2, key: "easy", short: "T2", label: "Easy" },
  { level: 3, key: "medium", short: "T3", label: "Medium" },
  { level: 4, key: "advanced", short: "T4", label: "Advanced" },
  { level: 5, key: "hard", short: "T5", label: "Hard" },
  { level: 6, key: "very-hard", short: "T6", label: "Very Hard" },
  { level: 7, key: "extreme", short: "T7", label: "Extreme" },
  { level: 8, key: "death", short: "T8", label: "Death" },
];

export interface TierRangeState {
  minTier: number;
  maxTier: number;
  includeUnranked: boolean;
  unrankedOnly: boolean;
}

export function TierRangeSlider({
  state,
  onChange,
  counts,
}: {
  state: TierRangeState;
  onChange: (next: TierRangeState) => void;
  counts: Record<number | "unranked", number>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Converts pointer clientX to tier level 1..8
  const getLevelFromPointer = useCallback((clientX: number): number => {
    if (!trackRef.current) return 1;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * 7) + 1; // Maps 0..1 to 1..8
  }, []);

  const handlePointerDownThumb = (e: React.PointerEvent, isMin: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const level = getLevelFromPointer(moveEvent.clientX);
      if (isMin) {
        onChange({
          ...state,
          minTier: Math.min(level, state.maxTier),
          unrankedOnly: false,
        });
      } else {
        onChange({
          ...state,
          maxTier: Math.max(level, state.minTier),
          unrankedOnly: false,
        });
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Clicking directly on the track snaps the nearest thumb
  const handleTrackClick = (e: React.MouseEvent) => {
    if (state.unrankedOnly) return;
    const clickedLevel = getLevelFromPointer(e.clientX);
    const distToMin = Math.abs(clickedLevel - state.minTier);
    const distToMax = Math.abs(clickedLevel - state.maxTier);

    if (distToMin <= distToMax) {
      onChange({
        ...state,
        minTier: Math.min(clickedLevel, state.maxTier),
        unrankedOnly: false,
      });
    } else {
      onChange({
        ...state,
        maxTier: Math.max(clickedLevel, state.minTier),
        unrankedOnly: false,
      });
    }
  };

  const setPreset = (min: number, max: number, unrankedOnly = false) => {
    onChange({
      minTier: min,
      maxTier: max,
      includeUnranked: min === 1 && max === 8,
      unrankedOnly,
    });
  };

  // Calculate percentages (1..8 -> 0%..100%)
  const leftPercent = ((state.minTier - 1) / 7) * 100;
  const rightPercent = ((state.maxTier - 1) / 7) * 100;

  // Active label readout
  const minLabel = TIER_LEVELS[state.minTier - 1]?.label ?? "";
  const maxLabel = TIER_LEVELS[state.maxTier - 1]?.label ?? "";

  return (
    <div className="tier-slider-wrapper">
      {/* Header with Live Range Readout & Presets */}
      <div className="tier-slider-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="pill-label">Tier Filter:</span>
          <span className="tier-readout-badge">
            {state.unrankedOnly
              ? "UNRANKED MAPS ONLY"
              : state.minTier === 1 && state.maxTier === 8
              ? "ALL TIERS (T1 → T8)"
              : state.minTier === state.maxTier
              ? `TIER ${state.minTier} (${minLabel.toUpperCase()})`
              : `TIER ${state.minTier} (${minLabel.toUpperCase()}) ↔ TIER ${state.maxTier} (${maxLabel.toUpperCase()})`}
          </span>
        </div>

        {/* Quick Presets */}
        <div className="tier-presets">
          <button
            type="button"
            className={`preset-btn ${!state.unrankedOnly && state.minTier === 1 && state.maxTier === 8 ? "active" : ""}`}
            onClick={() => setPreset(1, 8)}
          >
            All
          </button>
          <button
            type="button"
            className={`preset-btn ${!state.unrankedOnly && state.minTier === 1 && state.maxTier === 2 ? "active" : ""}`}
            onClick={() => setPreset(1, 2)}
          >
            T1–T2
          </button>
          <button
            type="button"
            className={`preset-btn ${!state.unrankedOnly && state.minTier === 3 && state.maxTier === 4 ? "active" : ""}`}
            onClick={() => setPreset(3, 4)}
          >
            T3–T4
          </button>
          <button
            type="button"
            className={`preset-btn ${!state.unrankedOnly && state.minTier === 5 && state.maxTier === 6 ? "active" : ""}`}
            onClick={() => setPreset(5, 6)}
          >
            T5–T6
          </button>
          <button
            type="button"
            className={`preset-btn ${!state.unrankedOnly && state.minTier >= 7 ? "active" : ""}`}
            onClick={() => setPreset(7, 8)}
          >
            T7–T8+
          </button>
          <button
            type="button"
            className={`preset-btn ${state.unrankedOnly ? "active" : ""}`}
            onClick={() => setPreset(1, 8, true)}
          >
            Unranked ({counts["unranked"] || 0})
          </button>
        </div>
      </div>

      {/* Dual Slider Interactive Track Area */}
      <div
        className="custom-slider-container"
        style={{
          opacity: state.unrankedOnly ? 0.3 : 1,
          pointerEvents: state.unrankedOnly ? "none" : "auto",
        }}
      >
        {/* Track Line */}
        <div
          className="custom-slider-track"
          ref={trackRef}
          onClick={handleTrackClick}
        >
          {/* Active highlighted range bar */}
          <div
            className="custom-slider-range"
            style={{
              left: `${leftPercent}%`,
              width: `${rightPercent - leftPercent}%`,
            }}
          />

          {/* Step dots on the line */}
          {TIER_LEVELS.map((t) => {
            const pct = ((t.level - 1) / 7) * 100;
            const inRange = t.level >= state.minTier && t.level <= state.maxTier;
            return (
              <div
                key={t.level}
                className={`custom-step-dot ${inRange ? "active" : ""}`}
                style={{ left: `${pct}%` }}
              />
            );
          })}

          {/* Left Thumb Handle (Min) */}
          <div
            className="custom-thumb-handle"
            style={{ left: `${leftPercent}%` }}
            onPointerDown={(e) => handlePointerDownThumb(e, true)}
            role="slider"
            aria-label="Minimum Tier"
            aria-valuenow={state.minTier}
            aria-valuemin={1}
            aria-valuemax={8}
            tabIndex={0}
          />

          {/* Right Thumb Handle (Max) */}
          <div
            className="custom-thumb-handle"
            style={{ left: `${rightPercent}%` }}
            onPointerDown={(e) => handlePointerDownThumb(e, false)}
            role="slider"
            aria-label="Maximum Tier"
            aria-valuenow={state.maxTier}
            aria-valuemin={1}
            aria-valuemax={8}
            tabIndex={0}
          />
        </div>

        {/* Step Tick Labels */}
        <div className="custom-slider-ticks">
          {TIER_LEVELS.map((t) => {
            const inRange =
              !state.unrankedOnly &&
              t.level >= state.minTier &&
              t.level <= state.maxTier;
            const count = counts[t.level] || 0;
            return (
              <div
                key={t.level}
                className={`custom-tick-mark ${inRange ? "active" : ""}`}
                onClick={() => setPreset(t.level, t.level)}
              >
                <span className="tick-label">{t.short}</span>
                <span className="tick-count">({count})</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
