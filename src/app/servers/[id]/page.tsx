import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { ServerDetailsClient } from "@/components/ServerDetailsClient";
import { cs2kzProvider } from "@/lib/providers/cs2kz";
import { queryServerPlayers } from "@/lib/a2s";

export const revalidate = 15;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const server = await cs2kzProvider.getServer(id);
  if (!server) {
    return {
      title: "Server Not Found - CS2KZ Viewer",
    };
  }
  return {
    title: `${server.name} - CS2KZ Servers`,
    description: `Live server status, current map ${server.a2s_info?.current_map || "rotation"}, and active connected players for ${server.name}.`,
  };
}

export default async function ServerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const serverId = parseInt(id, 10);

  if (Number.isNaN(serverId) || serverId <= 0) {
    notFound();
  }

  const server = await cs2kzProvider.getServer(serverId);
  if (!server) {
    notFound();
  }

  // Look up map information and pre-fetch players via UDP on SSR for instant Frame 0 render
  const currentMapName = server.a2s_info?.current_map;
  const [mapData, initialA2S] = await Promise.all([
    currentMapName ? cs2kzProvider.getMap(currentMapName) : Promise.resolve(null),
    server.host && server.port ? queryServerPlayers(server.host, server.port, 1800) : Promise.resolve(null),
  ]);

  const initialPlayerData = initialA2S?.success
    ? {
        available: true,
        count: initialA2S.count,
        namedCount: initialA2S.namedCount,
        anonymousCount: initialA2S.anonymousCount,
        isNamesHidden: initialA2S.isNamesHidden,
        players: initialA2S.players,
        maxPlayers: server.a2s_info?.max_players || 0,
      }
    : null;

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <div className="page-eyebrow" style={{ margin: 0 }}>
          GLOBAL NETWORK // SERVER DETAILS
        </div>
        <Link
          href="/servers"
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontFamily: "monospace",
          }}
        >
          <span>←</span>
          <span>BACK TO ALL SERVERS</span>
        </Link>
      </div>

      <h1 className="page-title" style={{ marginBottom: "20px" }}>
        {server.name}
      </h1>

      <ServerDetailsClient server={server} mapData={mapData} initialPlayerData={initialPlayerData} />
    </Shell>
  );
}
