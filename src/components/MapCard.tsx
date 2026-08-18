"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { KzMap, Mode } from "@/lib/types";
import { formatDate, getMapImageUrl, getTierInfo, resolveCanonicalTier } from "@/lib/format";

export function MapCard({
  map,
  mode = "classic",
  highlightTiers,
  includeUnranked = false,
}: {
  map: KzMap;
  mode?: Mode;
  highlightTiers?: Set<number>;
  includeUnranked?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const courses = map.courses ?? [];
  const mapperNames = (map.mappers ?? []).map((m) => m.name).join(", ") || "Unknown";
  const imageSrc = map.image_url || getMapImageUrl(map.name, 1);

  // Compute courses metadata for the active mode, filtering out impossible/unfeasible in VNL
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
        tierKey,
        tierLevel: tierInfo.level,
        tierInfo,
      };
    })
    .filter((cm) => {
      // Hide impossible tracks in VNL
      if (mode === "vanilla" && cm.isImpossible) return false;
      // Hide unranked tracks if unranked is not included
      if (!includeUnranked && !cm.isRanked) return false;
      return true;
    });

  return (
    <div className="map-card" style={{ display: "flex", flexDirection: "column", textDecoration: "none" }}>
      {/* Thumbnail */}
      <Link
        href={`/maps/${encodeURIComponent(map.name)}?mode=${mode}`}
        className="map-card-thumb-wrap"
        style={{ display: "block", textDecoration: "none" }}
      >
        {!imageFailed ? (
          <img
            className="map-card-thumb"
            src={imageSrc}
            alt={`${map.name} preview`}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="map-card-fallback-thumb" style={{ position: "relative" }}>
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0.15,
                pointerEvents: "none",
              }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id={`grid-${map.id}`} width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#ffffff" strokeWidth="0.75" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#grid-${map.id})`} />
              <line x1="0" y1="0" x2="100%" y2="100%" stroke="#ffffff" strokeWidth="0.5" strokeDasharray="4 4" />
            </svg>

            <div style={{ position: "relative", zIndex: 2 }}>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#f4f4f5",
                  letterSpacing: "-0.01em",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                }}
              >
                {map.name}
              </div>
              <div style={{ fontSize: "11px", color: "#71717a", fontFamily: "ui-monospace, monospace" }}>
                ID #{map.id} · {coursesMeta.length} {coursesMeta.length === 1 ? "COURSE" : "COURSES"}
              </div>
            </div>
          </div>
        )}
      </Link>

      {/* Card Body */}
      <div className="map-card-body" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* Title and Mapper */}
        <div>
          <Link
            href={`/maps/${encodeURIComponent(map.name)}?mode=${mode}`}
            className="map-card-title hover-underline"
            style={{ textDecoration: "none", color: "#ffffff", display: "block" }}
          >
            {map.name}
          </Link>
          <div style={{ fontSize: "11px", color: "var(--text-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {mapperNames}
          </div>
        </div>

        {/* Mini Course Boxes (Ranked/Unranked Light & Tier Badge for all tracks with tiers) */}
        {coursesMeta.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              marginTop: "2px",
              paddingTop: "6px",
              borderTop: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            {coursesMeta.map((cm) => {
              const isMatch = highlightTiers != null && highlightTiers.size > 0 && highlightTiers.has(cm.tierLevel);
              return (
                <Link
                  key={cm.course.name}
                  href={`/maps/${encodeURIComponent(map.name)}?course=${encodeURIComponent(cm.course.name)}&mode=${mode}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 6px",
                    borderRadius: "3.5px",
                    background: isMatch ? "rgba(95, 153, 217, 0.2)" : "rgba(255, 255, 255, 0.04)",
                    border: `1px solid ${isMatch ? "var(--user-blue)" : "var(--border)"}`,
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                    maxWidth: "100%",
                  }}
                  className="hover-card-border"
                  title={`${cm.course.name}: ${cm.isRanked ? "Ranked" : "Unranked"} · ${cm.tierInfo.short !== "—" ? `${cm.tierInfo.label} (${cm.tierInfo.short})` : "No Tier"}`}
                >
                  {/* Green Light (Ranked) vs Red Dot (Unranked) */}
                  <span
                    style={{
                      display: "inline-block",
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: cm.isRanked ? "rgb(74, 222, 128)" : "rgb(248, 113, 113)",
                      boxShadow: cm.isRanked ? "0 0 5px rgba(74, 222, 128, 0.6)" : "none",
                      flexShrink: 0,
                    }}
                  />

                  {/* Tier Number Badge (rendered if a tier exists, even for unranked courses) */}
                  {cm.tierInfo.short !== "—" && (
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 800,
                        color: "#ffffff",
                        backgroundColor: cm.tierInfo.color,
                        padding: "0 3px",
                        borderRadius: "2px",
                        fontFamily: "ui-monospace, monospace",
                        lineHeight: 1.2,
                        flexShrink: 0,
                      }}
                    >
                      {cm.tierInfo.short}
                    </span>
                  )}

                  {/* Course Track Name */}
                  <span
                    style={{
                      fontSize: "10.5px",
                      color: isMatch ? "#ffffff" : "var(--text)",
                      fontWeight: isMatch ? 700 : 500,
                      fontFamily: "ui-monospace, monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "120px",
                    }}
                  >
                    {cm.course.name}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Footer info */}
        <div
          className="map-card-footer"
          style={{ marginTop: "auto", paddingTop: "4px" }}
        >
          <span>{map.state ?? "approved"}</span>
          <span>{formatDate(map.approved_at)}</span>
        </div>
      </div>
    </div>
  );
}
