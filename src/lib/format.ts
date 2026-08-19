import { Course, KzMap, Mode, Tier } from "@/lib/types";

export const TIER_CONFIG: Record<
  Tier,
  { level: number; label: string; short: string; color: string; bg: string }
> = {
  "very-easy": { level: 1, label: "Very Easy", short: "T1", color: "rgb(34, 160, 80)", bg: "rgb(34, 160, 80)" }, // Light green
  "easy": { level: 2, label: "Easy", short: "T2", color: "rgb(22, 135, 60)", bg: "rgb(22, 135, 60)" },           // Dark green
  "medium": { level: 3, label: "Medium", short: "T3", color: "rgb(190, 140, 0)", bg: "rgb(190, 140, 0)" },      // Amber / Gold
  "advanced": { level: 4, label: "Advanced", short: "T4", color: "rgb(215, 115, 20)", bg: "rgb(215, 115, 20)" },  // Light orange
  "hard": { level: 5, label: "Hard", short: "T5", color: "rgb(205, 75, 15)", bg: "rgb(205, 75, 15)" },           // Dark orange
  "very-hard": { level: 6, label: "Very Hard", short: "T6", color: "rgb(205, 45, 45)", bg: "rgb(205, 45, 45)" },   // Red
  "extreme": { level: 7, label: "Extreme", short: "T7", color: "rgb(170, 20, 20)", bg: "rgb(170, 20, 20)" },     // Crimson dark red
  "death": { level: 8, label: "Death", short: "T8", color: "rgb(130, 25, 170)", bg: "rgb(130, 25, 170)" },         // Royal purple
  "unfeasible": { level: 0, label: "Unfeasible", short: "—", color: "rgb(75, 75, 85)", bg: "rgb(75, 75, 85)" },
  "impossible": { level: 0, label: "Impossible", short: "—", color: "rgb(75, 75, 85)", bg: "rgb(75, 75, 85)" },
};

/**
 * Resolves a canonical standard tier (1-8) favoring the primary nub_tier difficulty
 */
export function resolveCanonicalTier(nubTier?: string | null, proTier?: string | null): Tier | null {
  const isPlayable = (t?: string | null): t is Tier =>
    !!t && t in TIER_CONFIG && TIER_CONFIG[t as Tier].level >= 1 && TIER_CONFIG[t as Tier].level <= 8;

  if (isPlayable(nubTier)) return nubTier;
  if (isPlayable(proTier)) return proTier;
  return null;
}

export function getTierInfo(tier?: Tier | string | null) {
  if (!tier || !(tier in TIER_CONFIG)) {
    return { level: 0, label: "Unranked", short: "—", color: "rgb(75, 75, 85)", bg: "rgb(75, 75, 85)" };
  }
  return TIER_CONFIG[tier as Tier];
}

export function getRankColor(rank: number | null | undefined): string {
  if (rank == null || !Number.isFinite(rank) || rank <= 0) return "#a1a1aa";
  if (rank === 1) return "rgb(255, 215, 0)";   // Gold
  if (rank === 2) return "rgb(203, 213, 225)"; // Silver
  if (rank === 3) return "rgb(205, 127, 50)";  // Bronze
  if (rank <= 10) return "rgb(239, 68, 68)";   // Top 10 Red
  if (rank <= 20) return "rgb(236, 72, 153)";  // Top 20 Pink
  if (rank <= 50) return "rgb(249, 115, 22)";  // Top 50 Orange
  return "#a1a1aa";
}

export function formatRank(rank: number | null | undefined): string {
  if (rank == null || !Number.isFinite(rank) || rank <= 0) return "—";
  if (rank === 1) return "#1 🥇";
  if (rank === 2) return "#2 🥈";
  if (rank === 3) return "#3 🥉";
  return `#${rank}`;
}

export function getMapTier(map: KzMap, mode: Mode = "vanilla"): {
  level: number;
  label: string;
  short: string;
  color: string;
} {
  const courses = map.courses ?? [];
  if (courses.length === 0) return getTierInfo(null);

  const mainCourse =
    courses.find((c) => c.name.toLowerCase() === "main") ||
    courses.find((c) => c.name.toLowerCase() === map.name.toLowerCase()) ||
    courses[0];

  const filter = mainCourse.filters?.[mode];
  const canonicalKey = resolveCanonicalTier(filter?.nub_tier, filter?.pro_tier);
  return getTierInfo(canonicalKey);
}

export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return "--:--.---";
  const hours = Math.floor(seconds / 3600);
  const remainder = seconds % 3600;
  const mins = Math.floor(remainder / 60);
  const secs = Math.floor(remainder % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);

  const mm = mins.toString().padStart(2, "0");
  const ss = secs.toString().padStart(2, "0");
  const mmm = ms.toString().padStart(3, "0");

  if (hours > 0) {
    const hh = hours.toString().padStart(2, "0");
    return `${hh}:${mm}:${ss}.${mmm}`;
  }
  return `${mm}:${ss}.${mmm}`;
}

export function formatDifference(time: number, wr: number): string {
  if (!Number.isFinite(time) || !Number.isFinite(wr)) return "—";
  const diff = time - wr;
  if (diff <= 0.0001) return "WR";
  if (diff >= 3600) {
    const hours = Math.floor(diff / 3600);
    const rem = diff % 3600;
    const mins = Math.floor(rem / 60);
    const secs = (rem % 60).toFixed(3).padStart(6, "0");
    return `+${hours}:${mins.toString().padStart(2, "0")}:${secs}`;
  }
  if (diff >= 60) {
    const mins = Math.floor(diff / 60);
    const secs = (diff % 60).toFixed(3).padStart(6, "0");
    return `+${mins}:${secs}`;
  }
  return `+${diff.toFixed(3)}`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "—";
    return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  } catch {
    return "—";
  }
}

export function formatFullTimestamp(date: Date | null): string | undefined {
  if (!date || Number.isNaN(date.getTime())) return undefined;
  const YYYY = date.getUTCFullYear();
  const MM = String(date.getUTCMonth() + 1).padStart(2, "0");
  const DD = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss} UTC`;
}

export function getMapImageUrl(mapName: string, courseIndex: number = 1): string {
  return `https://github.com/kzglobalteam/cs2kz-images/raw/public/webp/medium/${encodeURIComponent(mapName)}/${courseIndex}.webp`;
}

export interface PlayerRankInfo {
  name: string;
  color: string;
  minPoints: number;
}

export const PLAYER_RANKS: PlayerRankInfo[] = [
  { name: "Legend", color: "rgb(195, 140, 0)", minPoints: 37500 },
  { name: "Master", color: "rgb(215, 35, 35)", minPoints: 35000 },
  { name: "Pro", color: "rgb(200, 60, 60)", minPoints: 30000 },
  { name: "Semi-Pro", color: "rgb(190, 85, 85)", minPoints: 25000 },
  { name: "Expert", color: "rgb(175, 40, 195)", minPoints: 20000 },
  { name: "Skilled", color: "rgb(140, 70, 200)", minPoints: 15000 },
  { name: "Regular", color: "rgb(60, 90, 220)", minPoints: 10000 },
  { name: "Casual", color: "rgb(55, 125, 190)", minPoints: 5000 },
  { name: "Beginner", color: "rgb(85, 90, 100)", minPoints: 0 },
];

export function getPlayerRank(points: number | null | undefined): PlayerRankInfo {
  const pts = typeof points === "number" && Number.isFinite(points) ? points : 0;
  for (const rank of PLAYER_RANKS) {
    if (pts >= rank.minPoints) {
      return rank;
    }
  }
  return PLAYER_RANKS[PLAYER_RANKS.length - 1];
}

export function getNextPlayerRank(points: number | null | undefined): {
  nextRank: PlayerRankInfo;
  pointsNeeded: number;
} | null {
  const pts = typeof points === "number" && Number.isFinite(points) ? points : 0;
  // If points >= Legend threshold (37,500), player is Legend (top rank), so return null
  if (pts >= PLAYER_RANKS[0].minPoints) {
    return null;
  }

  // Find the closest higher rank threshold
  for (let i = PLAYER_RANKS.length - 1; i >= 0; i--) {
    if (pts < PLAYER_RANKS[i].minPoints) {
      const nextRank = PLAYER_RANKS[i];
      const pointsNeeded = Math.ceil(nextRank.minPoints - pts);
      return {
        nextRank,
        pointsNeeded,
      };
    }
  }
  return null;
}

export function sanitizeSteamId(raw: string): string {
  let id = String(raw || "").trim();
  while (id.includes("%")) {
    try {
      const decoded = decodeURIComponent(id);
      if (decoded === id) break;
      id = decoded;
    } catch {
      break;
    }
  }
  return id;
}

export function getRecordTimestamp(recordId: string): Date | null {
  try {
    const clean = recordId.replace(/-/g, "");
    if (clean.length < 12) return null;
    const ms = parseInt(clean.slice(0, 12), 16);
    if (Number.isNaN(ms) || ms <= 0) return null;
    return new Date(ms);
  } catch {
    return null;
  }
}

export function formatRelativeTime(date: Date | null): string {
  if (!date) return "Recently";
  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "1d ago";
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}
