/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { MapControls } from "@/components/MapControls";
import { LeaderboardTable } from "@/components/Leaderboard";
import { MapArtwork } from "@/components/MapArtwork";
import { cs2kzProvider } from "@/lib/providers/cs2kz";
import { formatTime, getTierInfo, resolveCanonicalTier } from "@/lib/format";
import { Leaderboard, Mode } from "@/lib/types";

const isMode = (v?: string): v is Mode => v === "vanilla" || v === "classic";
const isBoard = (v?: string): v is Leaderboard => v === "overall" || v === "pro";

export const revalidate = 60;

export default async function MapPage({
  params,
  searchParams,
}: {
  params: Promise<{ mapName: string }>;
  searchParams: Promise<{ course?: string; mode?: string; leaderboard?: string }>;
}) {
  const { mapName } = await params;
  const query = await searchParams;

  const map = await cs2kzProvider.getMap(mapName);
  if (!map) notFound();

  const requestedCourse = query.course;
  const selectedCourse =
    map.courses.find((c) => c.name === requestedCourse) ?? map.courses[0];

  if (!selectedCourse) {
    return (
      <Shell>
        <div className="page-eyebrow">ERROR</div>
        <h1 className="page-title">No Courses Found</h1>
        <p className="page-desc">This map does not have any registered courses.</p>
        <Link className="btn-minimal" href="/maps">
          ← Back to Maps
        </Link>
      </Shell>
    );
  }

  // Determine active mode
  let mode: Mode = "vanilla";
  if (isMode(query.mode)) {
    mode = query.mode;
  } else {
    const vState = selectedCourse.filters?.vanilla?.state;
    const cState = selectedCourse.filters?.classic?.state;
    if (vState === "unranked" && cState === "ranked") {
      mode = "classic";
    }
  }

  const leaderboard: Leaderboard = isBoard(query.leaderboard)
    ? query.leaderboard
    : "overall";

  const courseIndex = Math.max(1, map.courses.indexOf(selectedCourse) + 1);

  // Fetch live records for the selected course
  const records = await cs2kzProvider.getRecords({
    map: map.name,
    course: selectedCourse.name,
    mode,
    leaderboard,
  });

  const filter = selectedCourse.filters?.[mode];
  const tierKey = resolveCanonicalTier(filter?.nub_tier, filter?.pro_tier);
  const tierInfo = getTierInfo(tierKey);
  const mappers = (map.mappers ?? []).map((m) => m.name).join(", ") || "Unknown";
  const wrRecord = records.values[0];

  return (
    <Shell>
      {/* 1. Top Breadcrumb & Action Links */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div className="page-eyebrow" style={{ margin: 0, fontSize: "12px" }}>
          <Link href="/maps" style={{ textDecoration: "none", color: "var(--user-blue)", fontWeight: 700 }}>
            ← MAPS
          </Link>{" "}
          / <span style={{ color: "#ffffff", fontWeight: 700 }}>{map.name.toUpperCase()}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {map.workshop_id && (
            <a
              className="btn-minimal"
              target="_blank"
              rel="noreferrer"
              href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${map.workshop_id}`}
              style={{ padding: "5px 12px", fontSize: "11.5px", fontWeight: 600 }}
            >
              Steam Workshop ↗
            </a>
          )}
          <Link
            className="btn-minimal"
            href="/maps"
            style={{ padding: "5px 12px", fontSize: "11.5px", fontWeight: 600 }}
          >
            All Maps →
          </Link>
        </div>
      </div>

      {/* 2. Unified Hero Overview (Full-Height Thumbnail matches Right Elements) */}
      <section
        className="map-hero-grid"
        style={{
          display: "grid",
          gap: "24px",
          marginBottom: "24px",
          alignItems: "stretch",
        }}
      >
        {/* Left Column: Full-Height Map Thumbnail */}
        <div style={{ display: "flex", height: "100%", minHeight: "100%" }}>
          <MapArtwork
            mapName={map.name}
            courseIndex={courseIndex}
            courseName={selectedCourse.name}
            imageUrl={map.image_url}
            style={{ height: "100%", width: "100%" }}
          />
        </div>

        {/* Right Column: Title + Badges, Course Subtitle, Controls with Metadata & 4 Stats Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0, justifyContent: "space-between" }}>
          {/* Title & Badges Integrated Header */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <h1
                style={{
                  fontSize: "30px",
                  fontWeight: 800,
                  color: "#ffffff",
                  letterSpacing: "-0.02em",
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                {map.name}
              </h1>

              {/* Tier & Mode Badges */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                {tierInfo.short !== "—" && (
                  <span
                    className="tag-badge"
                    style={{
                      backgroundColor: tierInfo.color,
                      borderColor: tierInfo.color,
                      color: "#ffffff",
                      fontWeight: 800,
                      fontSize: "11px",
                      padding: "3px 9px",
                      borderRadius: "4px",
                    }}
                  >
                    {tierInfo.short} · {tierInfo.label.toUpperCase()}
                  </span>
                )}
                <span
                  className="tag-badge"
                  style={{
                    fontSize: "11px",
                    padding: "3px 9px",
                    fontFamily: "monospace",
                    color: "#ffffff",
                    borderColor: "var(--border)",
                    background: "rgba(255, 255, 255, 0.04)",
                    borderRadius: "4px",
                  }}
                >
                  {mode === "vanilla" ? "VANILLA (VNL)" : "CLASSIC (CKZ)"}
                </span>
              </div>
            </div>

            {/* Spaced-Out Course Track Subtitle */}
            <div style={{ fontSize: "14px", color: "var(--text-subtle)", marginTop: "2px" }}>
              Course: <strong style={{ color: "#ffffff", fontWeight: 700 }}>{selectedCourse.name}</strong>{" "}
              <span style={{ opacity: 0.7, fontFamily: "monospace", fontSize: "12px" }}>
                ({courseIndex === 1 && map.courses.length === 1 ? "Main Track" : `Stage ${courseIndex} of ${map.courses.length}`})
              </span>
            </div>
          </div>

          {/* Unified Controls Component with Metadata under Courses */}
          <MapControls
            courses={map.courses}
            course={selectedCourse.name}
            mode={mode}
            leaderboard={leaderboard}
            mappers={mappers}
            approvedAt={map.approved_at}
          />

          {/* 4 Sized-Up, Tactile Quick Stat Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "12px",
            }}
          >
            <div className="stat-card" style={{ padding: "16px 18px", minHeight: "76px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px" }}>
              <span className="stat-label" style={{ fontSize: "10.5px", letterSpacing: "0.06em" }}>World Record</span>
              <span className="stat-value" style={{ color: "rgb(251, 191, 36)", fontSize: "18px", fontWeight: 800 }}>
                {formatTime(wrRecord?.time)}
              </span>
            </div>

            <div className="stat-card" style={{ padding: "16px 18px", minHeight: "76px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px" }}>
              <span className="stat-label" style={{ fontSize: "10.5px", letterSpacing: "0.06em" }}>WR Holder</span>
              {wrRecord?.player?.id ? (
                <Link
                  href={`/profile/${encodeURIComponent(wrRecord.player.id)}?mode=${mode}`}
                  className="stat-value hover-underline"
                  style={{
                    fontSize: "15px",
                    color: "var(--user-blue)",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "block",
                    fontWeight: 700,
                  }}
                  title={`View ${wrRecord.player.name}'s profile`}
                >
                  {wrRecord.player.name} ↗
                </Link>
              ) : (
                <span
                  className="stat-value"
                  style={{ fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {wrRecord?.player?.name ?? "—"}
                </span>
              )}
            </div>

            <div className="stat-card" style={{ padding: "16px 18px", minHeight: "76px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px" }}>
              <span className="stat-label" style={{ fontSize: "10.5px", letterSpacing: "0.06em" }}>Total Times</span>
              <span className="stat-value" style={{ fontSize: "18px", fontWeight: 800 }}>
                {records.total}
              </span>
            </div>

            <div className="stat-card" style={{ padding: "16px 18px", minHeight: "76px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px" }}>
              <span className="stat-label" style={{ fontSize: "10.5px", letterSpacing: "0.06em" }}>Difficulty</span>
              <span
                className="stat-value"
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: tierInfo.short !== "—" ? tierInfo.color : undefined,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {tierInfo.short !== "—" ? `${tierInfo.short} · ${tierInfo.label}` : "Unranked"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Leaderboard Table Section (Centered & Sized Evenly) */}
      <div style={{ maxWidth: "1150px", margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", margin: 0, letterSpacing: "-0.01em" }}>
            Leaderboard · {leaderboard === "overall" ? "Overall (Any TP)" : "Pro (0 Teleports)"}
          </h2>
          <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--text-subtle)" }}>
            SHOWING {records.values.length} OF {records.total} RECORDS
          </span>
        </div>

        <LeaderboardTable records={records.values} type={leaderboard} mode={mode} />
      </div>
    </Shell>
  );
}
