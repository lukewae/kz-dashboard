"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KzServer } from "@/lib/types";
import { getMapImageUrl } from "@/lib/format";
import { useFavoriteServers } from "@/lib/useFavoriteServers";

// Global Region Groups with Flags
export type RegionCode = "all" | "favorites" | "na" | "eu" | "apac" | "oce" | "sa";

export const REGION_TABS: { code: RegionCode; label: string; icon?: string; flagCode?: string; countries: string[] }[] = [
  { code: "all", label: "ALL REGIONS", icon: "🌐", countries: [] },
  { code: "favorites", label: "FAVORITES", icon: "★", countries: [] },
  { code: "na", label: "NORTH AMERICA (NA)", flagCode: "us", countries: ["US", "CA"] },
  { code: "eu", label: "EUROPE (EU)", flagCode: "eu", countries: ["DE", "FI", "DK", "SE", "AT", "ES", "GB", "BG", "TR", "FR", "NL", "PL", "NO", "IT", "RU"] },
  { code: "apac", label: "ASIA (APAC)", flagCode: "sg", countries: ["CN", "HK", "JP", "KR", "SG", "VN", "UZ", "MN", "TW", "TH", "MY", "IN"] },
  { code: "oce", label: "OCEANIA (OCE)", flagCode: "au", countries: ["AU", "NZ"] },
  { code: "sa", label: "SOUTH AMERICA (SA)", flagCode: "br", countries: ["BR", "AR", "CL", "PE", "CO"] },
];

export function estimateUserRegion(): RegionCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (
      tz.startsWith("Australia") ||
      tz.startsWith("Pacific/Auckland") ||
      tz.includes("Sydney") ||
      tz.includes("Melbourne") ||
      tz.includes("Brisbane") ||
      tz.includes("Perth") ||
      tz.includes("Adelaide") ||
      tz.includes("Hobart")
    ) {
      return "oce";
    }
    if (
      tz.startsWith("America/Sao_Paulo") ||
      tz.startsWith("America/Buenos_Aires") ||
      tz.startsWith("America/Santiago") ||
      tz.startsWith("America/Bogota") ||
      tz.startsWith("America/Lima")
    ) {
      return "sa";
    }
    if (tz.startsWith("America/")) {
      return "na";
    }
    if (tz.startsWith("Europe/") || tz.startsWith("Atlantic/")) {
      return "eu";
    }
    if (tz.startsWith("Asia/") || tz.startsWith("Indian/")) {
      return "apac";
    }
  } catch {
    // fallback
  }
  return "all";
}

/**
 * Accurately normalizes server country code and region, resolving DatHost / Vultr hosting misclassifications
 * (e.g. leetly.datho.st in Sydney was tagged as BR by GeoIP)
 */
export function normalizeServerGeo(server: KzServer): { countryCode: string; region: string } {
  const rawCountry = (server.geo_info?.country_code || "").toUpperCase();
  const rawRegion = server.geo_info?.region || "";
  const host = (server.host || "").toLowerCase();
  const name = (server.name || "").toLowerCase();

  // Known Australia / Oceania overrides
  if (
    host.includes("leetly") ||
    name.includes("leetly") ||
    host.startsWith("au.") ||
    name.includes("[au]") ||
    name.includes("australia") ||
    name.includes("sydney") ||
    name.includes("melbourne") ||
    name.includes("oceania")
  ) {
    return { countryCode: "AU", region: rawRegion && rawRegion !== "N/A" ? rawRegion : "Sydney" };
  }

  // Known North America overrides
  if (
    host.startsWith("na.") ||
    name.includes("[na]") ||
    name.includes("[chicago]") ||
    name.includes("[us]") ||
    name.includes("[la]") ||
    name.includes("[ny]")
  ) {
    return { countryCode: rawCountry || "US", region: rawRegion && rawRegion !== "N/A" ? rawRegion : "North America" };
  }

  // Known Europe overrides
  if (
    host.startsWith("eu.") ||
    name.includes("[eu]") ||
    name.includes("europe") ||
    name.includes("germany") ||
    name.includes("finland") ||
    name.includes("sweden")
  ) {
    return { countryCode: rawCountry && rawCountry !== "BR" ? rawCountry : "DE", region: rawRegion && rawRegion !== "N/A" ? rawRegion : "Europe" };
  }

  // Known Asia / APAC overrides
  if (
    host.startsWith("as.") ||
    host.startsWith("ap.") ||
    name.includes("[as]") ||
    name.includes("[apac]") ||
    name.includes("[asia]") ||
    name.includes("singapore") ||
    name.includes("tokyo")
  ) {
    return { countryCode: rawCountry && rawCountry !== "BR" ? rawCountry : "SG", region: rawRegion && rawRegion !== "N/A" ? rawRegion : "Asia" };
  }

  return { countryCode: rawCountry || "GL", region: rawRegion };
}

export function CountryFlag({
  countryCode,
  size = "md",
}: {
  countryCode?: string;
  size?: "sm" | "md";
}) {
  if (!countryCode || countryCode.length !== 2 || countryCode === "GL") {
    return <span style={{ fontSize: size === "sm" ? "12px" : "13px" }}>🌐</span>;
  }
  const code = countryCode.toLowerCase();
  const width = size === "sm" ? 17 : 19;
  const height = size === "sm" ? 12 : 14;

  return (
    <img
      src={`https://flagcdn.com/24x18/${code}.png`}
      alt={countryCode}
      width={width}
      height={height}
      style={{
        borderRadius: "2px",
        display: "inline-block",
        verticalAlign: "middle",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
        objectFit: "cover",
      }}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

export function formatLocation(countryCode?: string, region?: string): string {
  if (region && region !== "N/A" && region.trim().length > 0) {
    return region;
  }
  if (countryCode && countryCode !== "GL") {
    return countryCode.toUpperCase();
  }
  return "Global";
}

export function ServerMapThumb({
  mapName,
  size = "md",
}: {
  mapName: string;
  size?: "sm" | "md";
}) {
  const [hasError, setHasError] = useState(false);
  const isCustomOrUnknown = !mapName || mapName === "unknown" || mapName.trim().length === 0;
  const src = hasError || isCustomOrUnknown ? "/kz-logo.png" : getMapImageUrl(mapName, 1);
  const showFallback = hasError || isCustomOrUnknown;

  return (
    <Link
      href={`/maps/${encodeURIComponent(mapName || "maps")}`}
      style={{
        display: "block",
        position: "relative",
        borderRadius: size === "sm" ? "4px" : "6px",
        overflow: "hidden",
        aspectRatio: "16 / 9",
        background: showFallback ? "#141418" : "#0d0d10",
        border: "1px solid var(--border)",
        textDecoration: "none",
        width: "100%",
        height: "100%",
      }}
      title={`View map page for ${mapName}`}
    >
      <img
        src={src}
        alt={mapName}
        style={{
          width: "100%",
          height: "100%",
          objectFit: showFallback ? "contain" : "cover",
          padding: showFallback ? (size === "sm" ? "6px" : "10px") : 0,
          display: "block",
        }}
        onError={() => setHasError(true)}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          insetInline: 0,
          background: "linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, transparent 100%)",
          padding: "4px 2px",
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontSize: size === "sm" ? "9px" : "9.5px",
            fontFamily: "monospace",
            color: "#ffffff",
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "block",
          }}
        >
          {mapName || "Rotating Map"}
        </span>
      </div>
    </Link>
  );
}

export function ServersBrowser({ initialServers }: { initialServers: KzServer[] }) {
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<RegionCode>("all");
  const [hasPlayersOnly, setHasPlayersOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"players-desc" | "name-asc" | "map-asc" | "region-asc">("players-desc");
  const [copiedServerId, setCopiedServerId] = useState<number | null>(null);

  const { isFavorite, toggleFavorite, favorites } = useFavoriteServers();

  // Auto-detect closest region on initial mount unless manually set before
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kz_default_region") as RegionCode | null;
      if (stored && (stored === "all" || stored === "favorites" || REGION_TABS.some((r) => r.code === stored))) {
        setSelectedRegion(stored);
      } else {
        const estimated = estimateUserRegion();
        setSelectedRegion(estimated);
        localStorage.setItem("kz_default_region", estimated);
      }
    } catch {
      // fallback
    }
  }, []);

  const handleSelectRegion = (code: RegionCode) => {
    setSelectedRegion(code);
    try {
      localStorage.setItem("kz_default_region", code);
    } catch {
      // fallback
    }
  };

  // Active online servers (have valid a2s_info)
  const activeServers = useMemo(() => {
    return initialServers.filter((s) => s.a2s_info != null);
  }, [initialServers]);

  // Handle Copy Connect
  const copyConnect = (server: KzServer) => {
    const connectCmd = `connect ${server.host}:${server.port}`;
    navigator.clipboard.writeText(connectCmd);
    setCopiedServerId(server.id);
    setTimeout(() => {
      setCopiedServerId((prev) => (prev === server.id ? null : prev));
    }, 2000);
  };

  // Filtered & sorted servers
  const filteredServers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const regionObj = REGION_TABS.find((r) => r.code === selectedRegion);

    return activeServers
      .filter((s) => {
        const a2s = s.a2s_info;
        const normalized = normalizeServerGeo(s);
        const country = normalized.countryCode;

        // Favorites Filter Tab
        if (selectedRegion === "favorites") {
          if (!isFavorite(s.id)) return false;
        } else if (selectedRegion !== "all" && regionObj) {
          // Region Filter
          if (!regionObj.countries.includes(country)) {
            return false;
          }
        }

        // Has Players Filter
        if (hasPlayersOnly && (a2s?.num_players || 0) === 0) {
          return false;
        }

        // Search Filter (Server Name, Map Name, Host/IP, City/Region)
        if (query) {
          const matchName = s.name.toLowerCase().includes(query);
          const matchMap = (a2s?.current_map || "").toLowerCase().includes(query);
          const matchHost = `${s.host}:${s.port}`.toLowerCase().includes(query);
          const matchRegion = normalized.region.toLowerCase().includes(query);
          const matchCountry = country.toLowerCase().includes(query);

          if (!matchName && !matchMap && !matchHost && !matchRegion && !matchCountry) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const aPlayers = a.a2s_info?.num_players || 0;
        const bPlayers = b.a2s_info?.num_players || 0;

        if (sortBy === "players-desc") {
          if (bPlayers !== aPlayers) return bPlayers - aPlayers;
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "name-asc") {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "map-asc") {
          const mapA = a.a2s_info?.current_map || "";
          const mapB = b.a2s_info?.current_map || "";
          return mapA.localeCompare(mapB);
        }
        if (sortBy === "region-asc") {
          const normA = normalizeServerGeo(a);
          const normB = normalizeServerGeo(b);
          return normA.countryCode.localeCompare(normB.countryCode) || (bPlayers - aPlayers);
        }
        return 0;
      });
  }, [activeServers, search, selectedRegion, hasPlayersOnly, sortBy, isFavorite]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Header Toolbar: Search + Quick Regions + Sort & Toggles */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "18px 20px",
        }}
      >
        {/* Top Controls Row */}
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
          <div style={{ flex: 1, minWidth: "260px" }}>
            <input
              type="text"
              className="sidebar-user-input"
              style={{ width: "100%", padding: "8px 14px", fontSize: "12px" }}
              placeholder="Search by server name, current map, host IP, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            {/* Has Players Only Toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={hasPlayersOnly}
              onClick={() => setHasPlayersOnly((prev) => !prev)}
              className="pill-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                padding: "6px 12px",
                fontWeight: 600,
                background: hasPlayersOnly ? "rgba(95, 153, 217, 0.2)" : "rgba(255, 255, 255, 0.04)",
                borderColor: hasPlayersOnly ? "var(--user-blue)" : "var(--border)",
                color: hasPlayersOnly ? "#ffffff" : "var(--text-subtle)",
                transition: "all 0.15s ease",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: hasPlayersOnly ? "var(--user-blue)" : "rgba(255, 255, 255, 0.2)",
                  boxShadow: hasPlayersOnly ? "0 0 6px rgba(95, 153, 217, 0.8)" : "none",
                }}
              />
              <span>Has Players Only</span>
            </button>

            {/* Sort Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="pill-label">Sort:</span>
              <select
                className="select-control"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                style={{ padding: "6px 10px", fontSize: "12px" }}
              >
                <option value="players-desc">Most Players</option>
                <option value="name-asc">Server Name (A → Z)</option>
                <option value="region-asc">Region / Location</option>
                <option value="map-asc">Current Map</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bottom Region Quick Filters with Authentic Flags */}
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
            Regions:
          </span>

          {REGION_TABS.map((tab) => {
            const isActive = selectedRegion === tab.code;
            const isFavTab = tab.code === "favorites";

            return (
              <button
                key={tab.code}
                type="button"
                className={`pill-btn ${isActive ? "active" : ""}`}
                onClick={() => handleSelectRegion(tab.code)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: isActive ? 700 : 500,
                  color: isFavTab && !isActive ? "rgb(251, 191, 36)" : undefined,
                  borderColor: isFavTab && !isActive ? "rgba(251, 191, 36, 0.4)" : undefined,
                }}
              >
                {tab.flagCode ? (
                  <img
                    src={`https://flagcdn.com/24x18/${tab.flagCode}.png`}
                    alt={tab.label}
                    width={16}
                    height={12}
                    style={{ borderRadius: "2px", objectFit: "cover", display: "inline-block" }}
                  />
                ) : (
                  <span>{tab.icon}</span>
                )}
                <span>{tab.label}</span>
                {isFavTab && favorites.length > 0 && (
                  <span style={{ fontSize: "9.5px", opacity: 0.8, fontFamily: "monospace", marginLeft: "2px" }}>
                    ({favorites.length})
                  </span>
                )}
              </button>
            );
          })}

          {(search !== "" || selectedRegion !== "all" || hasPlayersOnly) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                handleSelectRegion("all");
                setHasPlayersOnly(false);
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

      {/* 2. Clean Stats Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          padding: "0 4px",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--text-subtle)", fontFamily: "monospace" }}>
          Showing <strong style={{ color: "#ffffff" }}>{filteredServers.length}</strong> online servers
          {selectedRegion !== "all" && (
            <span style={{ opacity: 0.75 }}> · {REGION_TABS.find((r) => r.code === selectedRegion)?.label}</span>
          )}
        </span>
      </div>

      {/* 3. Global Servers Grid */}
      {filteredServers.length > 0 ? (
        <div
          className="servers-grid"
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          {filteredServers.map((server) => {
            const a2s = server.a2s_info;
            const normalized = normalizeServerGeo(server);
            const currentMap = a2s?.current_map || "unknown";
            const numPlayers = a2s?.num_players || 0;
            const maxPlayers = a2s?.max_players || 0;
            const percent = maxPlayers > 0 ? Math.min(100, Math.round((numPlayers / maxPlayers) * 100)) : 0;
            const locationText = formatLocation(normalized.countryCode, normalized.region);
            const isCopied = copiedServerId === server.id;
            const fav = isFavorite(server.id);

            return (
              <div
                key={server.id}
                style={{
                  background: "var(--surface)",
                  border: fav ? "1px solid rgba(251, 191, 36, 0.45)" : "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  position: "relative",
                  transition: "border-color 0.15s ease",
                  boxShadow: fav ? "0 0 12px rgba(251, 191, 36, 0.08)" : "none",
                }}
                className="hover-card-border"
              >
                {/* Top Section: Map Thumbnail + Server Details */}
                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "14px", alignItems: "start" }}>
                  {/* Map Artwork Box with State-tracked CS2KZ Logo Fallback */}
                  <div style={{ width: "110px" }}>
                    <ServerMapThumb mapName={currentMap} size="md" />
                  </div>

                  {/* Server Details Header */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                    {/* Server Name & Favorite Star Button */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "#ffffff",
                          letterSpacing: "-0.01em",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          lineHeight: 1.25,
                          flex: 1,
                        }}
                        title={server.name}
                      >
                        {server.name}
                      </div>

                      {/* Favorite Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          toggleFavorite(server.id);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: "0 2px",
                          fontSize: "16px",
                          color: fav ? "rgb(251, 191, 36)" : "rgba(255, 255, 255, 0.25)",
                          transition: "color 0.15s ease, transform 0.15s ease",
                          transform: fav ? "scale(1.15)" : "scale(1)",
                        }}
                        title={fav ? "Remove from Favorites" : "Add to Favorites"}
                      >
                        {fav ? "★" : "☆"}
                      </button>
                    </div>

                    {/* Region / Flag & Host IP */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "11.5px" }}>
                      <CountryFlag countryCode={normalized.countryCode} size="sm" />
                      <span style={{ color: "var(--text-subtle)", fontWeight: 600 }}>
                        {locationText}
                      </span>
                      <span style={{ color: "rgba(255, 255, 255, 0.15)" }}>•</span>
                      <span
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          color: "var(--text-muted)",
                          fontSize: "10.5px",
                        }}
                      >
                        {server.host}:{server.port}
                      </span>
                    </div>

                    {/* Current Map Name Link */}
                    <div style={{ fontSize: "11px", color: "var(--text-subtle)", marginTop: "2px" }}>
                      Map:{" "}
                      <Link
                        href={`/maps/${encodeURIComponent(currentMap)}`}
                        style={{ color: "var(--user-blue)", textDecoration: "none", fontWeight: 600 }}
                        className="hover-underline"
                      >
                        {currentMap} ↗
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Middle: Player Meter Progress Bar */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", fontFamily: "monospace" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: numPlayers > 0 ? "rgb(74, 222, 128)" : "rgba(255, 255, 255, 0.3)",
                          boxShadow: numPlayers > 0 ? "0 0 6px rgba(74, 222, 128, 0.7)" : "none",
                        }}
                      />
                      <span style={{ color: numPlayers > 0 ? "#ffffff" : "var(--text-subtle)", fontWeight: numPlayers > 0 ? 700 : 500 }}>
                        {numPlayers} / {maxPlayers} Players
                      </span>
                    </div>
                    <span style={{ color: "var(--text-subtle)", fontSize: "10.5px" }}>
                      {percent}% full
                    </span>
                  </div>

                  {/* Meter Track */}
                  <div
                    style={{
                      height: "4px",
                      width: "100%",
                      borderRadius: "2px",
                      background: "rgba(255, 255, 255, 0.06)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${percent}%`,
                        borderRadius: "2px",
                        backgroundColor:
                          percent >= 90
                            ? "rgb(239, 68, 68)"
                            : percent > 0
                            ? "rgb(74, 222, 128)"
                            : "transparent",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>

                {/* Bottom Action Buttons: Copy Connect & Direct Steam Connect */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "8px",
                    alignItems: "center",
                    marginTop: "auto",
                    paddingTop: "8px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => copyConnect(server)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 700,
                      fontFamily: "ui-monospace, monospace",
                      background: isCopied ? "rgba(74, 222, 128, 0.2)" : "rgba(255, 255, 255, 0.05)",
                      border: `1px solid ${isCopied ? "rgb(74, 222, 128)" : "var(--border)"}`,
                      color: isCopied ? "rgb(74, 222, 128)" : "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    title={`Copy 'connect ${server.host}:${server.port}' to clipboard`}
                  >
                    <span>{isCopied ? "✓" : "📋"}</span>
                    <span>{isCopied ? "Copied Connect Command!" : `connect ${server.host}:${server.port}`}</span>
                  </button>

                  <a
                    href={`steam://connect/${server.host}:${server.port}`}
                    className="btn-minimal"
                    style={{
                      padding: "6px 12px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      background: "var(--user-blue)",
                      borderColor: "var(--user-blue)",
                      color: "#ffffff",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    title="Launch Counter-Strike 2 and join server directly"
                  >
                    <span>Join</span>
                    <span>↗</span>
                  </a>
                </div>
              </div>
            );
          })}
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
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>📡</div>
          <h4 style={{ fontSize: "15px", color: "#ffffff", margin: "0 0 6px 0" }}>
            {selectedRegion === "favorites" ? "No favorite servers added yet" : "No online servers found"}
          </h4>
          <p style={{ fontSize: "12px", margin: 0 }}>
            {selectedRegion === "favorites"
              ? "Click the star (☆) on any server card to add it to your favorites list."
              : 'Try clearing your search query or selecting "All Regions".'}
          </p>
          <button
            type="button"
            className="btn-minimal"
            onClick={() => {
              setSearch("");
              handleSelectRegion("all");
              setHasPlayersOnly(false);
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
