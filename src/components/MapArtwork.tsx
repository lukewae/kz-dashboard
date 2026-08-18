"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { getMapImageUrl } from "@/lib/format";

export function MapArtwork({
  mapName,
  courseIndex = 1,
  courseName,
  imageUrl,
  style,
}: {
  mapName: string;
  courseIndex?: number;
  courseName?: string;
  imageUrl?: string | null;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl || getMapImageUrl(mapName, courseIndex);

  if (failed) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          minHeight: "260px",
          background: "radial-gradient(circle at center, #1c1c22 0%, #0d0d10 100%)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
          ...style,
        }}
      >
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
            <pattern id="header-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#ffffff" strokeWidth="0.75" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#header-grid)" />
          <line x1="0" y1="0" x2="100%" y2="100%" stroke="#ffffff" strokeWidth="0.5" strokeDasharray="4 4" />
        </svg>

        <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "16px" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "#fff", textTransform: "uppercase", marginBottom: "4px" }}>
            {mapName}
          </div>
          <div style={{ fontSize: "12px", fontFamily: "ui-monospace, monospace", color: "var(--text-subtle)" }}>
            COURSE // {courseName ?? `STAGE ${courseIndex}`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "260px",
        background: "#0d0d10",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
        position: "relative",
        ...style,
      }}
    >
      <img
        src={src}
        alt={`${mapName} preview`}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
