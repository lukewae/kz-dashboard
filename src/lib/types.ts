export type Mode = "vanilla" | "classic";
export type Leaderboard = "overall" | "pro";

export type Tier =
  | "very-easy"
  | "easy"
  | "medium"
  | "advanced"
  | "hard"
  | "very-hard"
  | "extreme"
  | "death"
  | "unfeasible"
  | "impossible";

export interface CourseFilter {
  nub_tier?: Tier;
  pro_tier?: Tier;
  state?: "ranked" | "unranked" | string;
  notes?: string | null;
}

export interface Course {
  name: string;
  description?: string | null;
  mappers?: { id: string; name: string }[];
  filters?: Record<Mode, CourseFilter>;
}

export interface KzMap {
  id: number;
  workshop_id?: number;
  name: string;
  description?: string | null;
  state?: string;
  mappers?: { id: string; name: string }[];
  courses: Course[];
  approved_at?: string;
  image_url?: string | null;
}

export interface KzRecord {
  id: string;
  player: { id: string; name: string };
  server: { id: number; name: string };
  map?: { id: number; name: string };
  course?: {
    id: number;
    name: string;
    nub_tier?: Tier;
    pro_tier?: Tier;
    state?: string;
  };
  mode: Mode;
  teleports: number;
  time: number;
  nub_rank?: number | null;
  nub_points?: number | null;
  pro_rank?: number | null;
  pro_points?: number | null;
  replay_available?: boolean;
}

export interface KzPlayer {
  id: string;
  name: string;
  is_prime_verified?: boolean;
  vnl_rating?: number | null;
  ckz_rating?: number | null;
  first_joined_at?: string;
}

export interface KzSteamProfile {
  id: string;
  name: string;
  profile_url?: string;
  avatar_url?: string;
}

export interface Page<T> {
  total: number;
  values: T[];
}

export interface RecordsQuery {
  map?: string;
  course?: string;
  player?: string;
  mode: Mode;
  leaderboard?: Leaderboard;
  limit?: number;
  offset?: number;
}

export interface ServerA2sInfo {
  current_map: string;
  current_map_info?: {
    workshop_id?: number;
    global_state?: string;
  };
  num_players: number;
  max_players: number;
  _updated_at?: string;
}

export interface ServerGeoInfo {
  country_code?: string;
  region?: string;
  _updated_at?: string;
}

export interface KzServer {
  id: number;
  name: string;
  host: string;
  port: number;
  owner?: {
    id: string;
    name: string;
  };
  approved_at?: string;
  a2s_info?: ServerA2sInfo | null;
  geo_info?: ServerGeoInfo | null;
}

export interface KzDataProvider {
  game: "cs2" | "csgo";
  getAllMaps(): Promise<KzMap[]>;
  searchMaps(query: string): Promise<KzMap[]>;
  getMap(name: string): Promise<KzMap | null>;
  getRecords(query: RecordsQuery): Promise<Page<KzRecord>>;
  getPlayer(steamId: string): Promise<KzPlayer | null>;
  getPlayerSteamProfile(steamId: string): Promise<KzSteamProfile | null>;
  getPlayerRecords(
    steamId: string,
    options?: { mode?: Mode; leaderboard?: Leaderboard }
  ): Promise<Page<KzRecord>>;
  getWorldRecords(options?: { mode?: Mode; limit?: number }): Promise<KzRecord[]>;
  getTopPlayers(options?: { mode?: Mode; limit?: number; offset?: number }): Promise<Page<KzPlayer>>;
  getServers(): Promise<KzServer[]>;
}
