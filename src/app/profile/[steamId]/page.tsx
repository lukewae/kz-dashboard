/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { cs2kzProvider } from "@/lib/providers/cs2kz";
import { formatDate, getPlayerRank, sanitizeSteamId } from "@/lib/format";
import { Leaderboard, Mode } from "@/lib/types";
import { ProfileBrowser } from "@/components/ProfileBrowser";

const isMode = (v?: string): v is Mode => v === "vanilla" || v === "classic";
const isBoard = (v?: string): v is Leaderboard => v === "overall" || v === "pro";

export const revalidate = 60;

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ steamId: string }>;
  searchParams: Promise<{ mode?: string; leaderboard?: string }>;
}) {
  const rawSteamId = (await params).steamId;
  const steamId = sanitizeSteamId(rawSteamId);
  const query = await searchParams;

  const mode: Mode = isMode(query.mode) ? query.mode : "classic";
  const leaderboard: Leaderboard = isBoard(query.leaderboard)
    ? query.leaderboard
    : "overall";

  // Fetch player, steam profile, records, catalog, top players, and world records in parallel
  const [player, steamProfile, records, allMaps, topPlayersData, worldRecords] = await Promise.all([
    cs2kzProvider.getPlayer(steamId),
    cs2kzProvider.getPlayerSteamProfile(steamId),
    cs2kzProvider.getPlayerRecords(steamId, { mode, leaderboard }),
    cs2kzProvider.getAllMaps(),
    cs2kzProvider.getTopPlayers({ mode, limit: 1000 }),
    cs2kzProvider.getWorldRecords({ mode }),
  ]);

  if (!player && (!records || records.total === 0)) {
    notFound();
  }

  // Calculate overall rating rank
  const cleanId = sanitizeSteamId(steamId);
  const overallRankIdx = topPlayersData.values.findIndex(
    (p) => sanitizeSteamId(p.id) === cleanId
  );
  const overallRank = overallRankIdx !== -1 ? overallRankIdx + 1 : null;

  // Calculate WR leaderboard rank
  const wrCounts: Record<string, number> = {};
  worldRecords.forEach((r) => {
    if (r.player?.id) {
      const pid = sanitizeSteamId(r.player.id);
      wrCounts[pid] = (wrCounts[pid] || 0) + 1;
    }
  });
  const sortedWrHolders = Object.entries(wrCounts)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);
  const wrRankIdx = sortedWrHolders.findIndex((h) => h.id === cleanId);
  const wrLeaderboardRank = wrRankIdx !== -1 ? wrRankIdx + 1 : null;

  const playerName = steamProfile?.name || player?.name || steamId;
  const rating = mode === "classic" ? player?.ckz_rating : player?.vnl_rating;
  const rankInfo = getPlayerRank(rating);
  const avatarUrl = steamProfile?.avatar_url;
  const profileUrl = steamProfile?.profile_url;

  return (
    <Shell>
      {/* Breadcrumbs */}
      <div className="page-eyebrow">
        <Link href="/maps" style={{ textDecoration: "underline" }}>
          MAPS
        </Link>{" "}
        / PLAYERS / {steamId}
      </div>

      {/* Profile Header Section (Borderless Clean Layout) */}
      <section
        style={{
          display: "flex",
          gap: "22px",
          alignItems: "center",
          padding: "4px 0 16px 0",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: "92px",
            height: "92px",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            background: "#18181c",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
            flexShrink: 0,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={playerName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "monospace",
                fontSize: "26px",
                color: "var(--text-subtle)",
              }}
            >
              KZ
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: "260px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.15 }}>
              {playerName}
            </h1>
            {/* Custom Rank Badge */}
            <span
              style={{
                backgroundColor: rankInfo.color,
                border: `1px solid ${rankInfo.color}`,
                color: "#ffffff",
                borderRadius: "var(--radius-sm)",
                padding: "4px 10px",
                fontSize: "11.5px",
                fontFamily: "ui-monospace, monospace",
                fontWeight: 800,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                boxShadow: `0 0 12px ${rankInfo.color}33`,
              }}
            >
              {rankInfo.name}
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <span className="tag-badge" style={{ fontSize: "12px", padding: "4px 10px" }}>
              {steamId}
            </span>
            {player?.first_joined_at && (
              <span className="tag-badge" style={{ fontSize: "12px", padding: "4px 10px" }}>
                JOINED {formatDate(player.first_joined_at)}
              </span>
            )}
          </div>
        </div>

        {/* Steam Community Link */}
        {profileUrl && (
          <div>
            <a
              className="btn-minimal"
              target="_blank"
              rel="noreferrer"
              href={profileUrl}
              style={{ padding: "8px 16px", fontSize: "12px" }}
            >
              Steam Community Profile ↗
            </a>
          </div>
        )}
      </section>

      {/* Interactive Profile Browser (Mode, Leaderboard, WRs/Top 10 Module, Stats Cards, Filters & Records Table) */}
      <ProfileBrowser
        player={player}
        records={records.values}
        allMaps={allMaps}
        steamId={steamId}
        mode={mode}
        leaderboard={leaderboard}
        overallRank={overallRank}
        wrLeaderboardRank={wrLeaderboardRank}
      />
    </Shell>
  );
}
