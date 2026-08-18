"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { formatDate, getTierInfo, resolveCanonicalTier } from "@/lib/format";
import { Course, Leaderboard, Mode } from "@/lib/types";

export function MapControls({
  courses,
  course,
  mode,
  leaderboard,
  mappers,
  approvedAt,
}: {
  courses: Course[];
  course: string;
  mode: Mode;
  leaderboard: Leaderboard;
  mappers?: string;
  approvedAt?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.push(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "14px 16px",
      }}
    >
      {/* Top Row: Mode & Leaderboard Controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          paddingBottom: courses.length > 0 ? "10px" : "0px",
          borderBottom: courses.length > 0 ? "1px solid var(--border)" : "none",
        }}
      >
        {/* Mode Controls */}
        <div className="pill-group" style={{ margin: 0 }}>
          <span className="pill-label">Mode:</span>
          <button
            type="button"
            className={`pill-btn ${mode === "classic" ? "active" : ""}`}
            onClick={() => set("mode", "classic")}
          >
            CLASSIC (CKZ)
          </button>
          <button
            type="button"
            className={`pill-btn ${mode === "vanilla" ? "active" : ""}`}
            onClick={() => set("mode", "vanilla")}
          >
            VANILLA (VNL)
          </button>
        </div>

        {/* Leaderboard Controls */}
        <div className="pill-group" style={{ margin: 0 }}>
          <span className="pill-label">Leaderboard:</span>
          <button
            type="button"
            className={`pill-btn ${leaderboard === "overall" ? "active" : ""}`}
            onClick={() => set("leaderboard", "overall")}
          >
            OVERALL
          </button>
          <button
            type="button"
            className={`pill-btn ${leaderboard === "pro" ? "active" : ""}`}
            onClick={() => set("leaderboard", "pro")}
          >
            PRO (NO TP)
          </button>
        </div>
      </div>

      {/* Bottom Section: Individual Course Selection Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: "11px",
              fontFamily: "ui-monospace, monospace",
              textTransform: "uppercase",
              color: "var(--text-subtle)",
              letterSpacing: "0.06em",
              fontWeight: 700,
            }}
          >
            Courses ({courses.length})
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {courses.map((c) => {
            const filt = c.filters?.[mode];
            const isRanked = filt?.state?.toLowerCase() === "ranked";
            const isActive = c.name === course;
            const tierKey = resolveCanonicalTier(filt?.nub_tier, filt?.pro_tier);
            const tierInfo = getTierInfo(tierKey);

            return (
              <button
                key={c.name}
                type="button"
                onClick={() => set("course", c.name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "12px",
                  fontWeight: isActive ? 700 : 500,
                  background: isActive
                    ? "rgba(95, 153, 217, 0.18)"
                    : "var(--panel)",
                  color: isActive ? "#ffffff" : "var(--text)",
                  border: isActive
                    ? "1px solid var(--user-blue)"
                    : "1px solid var(--border)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Green Tick (Ranked) vs Red X (Unranked) Indicator */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "15px",
                    height: "15px",
                    borderRadius: "50%",
                    fontSize: "9.5px",
                    fontWeight: 900,
                    background: isRanked ? "rgba(74, 222, 128, 0.15)" : "rgba(248, 113, 113, 0.15)",
                    color: isRanked ? "rgb(74, 222, 128)" : "rgb(248, 113, 113)",
                    border: `1px solid ${isRanked ? "rgba(74, 222, 128, 0.3)" : "rgba(248, 113, 113, 0.3)"}`,
                    flexShrink: 0,
                  }}
                  title={isRanked ? "Ranked in this mode" : "Unranked in this mode"}
                >
                  {isRanked ? "✓" : "✕"}
                </span>

                {/* Solid Tier Badge (displayed for all tracks with tiers, even if unranked) */}
                {tierInfo.short !== "—" && (
                  <span
                    className="tag-badge"
                    style={{
                      fontSize: "9.5px",
                      fontWeight: 800,
                      color: "#ffffff",
                      backgroundColor: tierInfo.color,
                      borderColor: tierInfo.color,
                      padding: "1px 5px",
                      borderRadius: "3px",
                    }}
                  >
                    {tierInfo.short}
                  </span>
                )}

                {/* Course Name */}
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>

        {/* Subtle Metadata Row below Courses */}
        {(mappers || approvedAt) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "4px",
              paddingTop: "8px",
              borderTop: "1px solid rgba(255, 255, 255, 0.05)",
              fontSize: "11.5px",
              color: "var(--text-subtle)",
            }}
          >
            {mappers && (
              <span>
                Mapper: <strong style={{ color: "#ffffff", fontWeight: 600 }}>{mappers}</strong>
              </span>
            )}
            {approvedAt && (
              <span>
                Approved: <strong style={{ color: "#ffffff", fontWeight: 600 }}>{formatDate(approvedAt)}</strong>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
