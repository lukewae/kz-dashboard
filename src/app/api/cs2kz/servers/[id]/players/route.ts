import { NextRequest, NextResponse } from "next/server";
import { cs2kzProvider } from "@/lib/providers/cs2kz";
import { queryServerPlayers } from "@/lib/a2s";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const serverId = parseInt(id, 10);

  if (Number.isNaN(serverId) || serverId <= 0) {
    return NextResponse.json({ available: false, error: "Invalid server ID" }, { status: 400 });
  }

  try {
    const server = await cs2kzProvider.getServer(serverId);
    if (!server || !server.host || !server.port) {
      return NextResponse.json(
        { available: false, error: "Server not found or offline" },
        { status: 404 }
      );
    }

    // Query active players via UDP A2S protocol
    const queryResult = await queryServerPlayers(server.host, server.port, 2500);

    if (queryResult.success) {
      return NextResponse.json(
        {
          available: true,
          count: queryResult.count,
          namedCount: queryResult.namedCount,
          anonymousCount: queryResult.anonymousCount,
          isNamesHidden: queryResult.isNamesHidden,
          players: queryResult.players,
          maxPlayers: server.a2s_info?.max_players || 0,
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
          },
        }
      );
    }

    // Fallback if UDP times out or is blocked
    return NextResponse.json(
      {
        available: false,
        fallbackCount: server.a2s_info?.num_players || 0,
        maxPlayers: server.a2s_info?.max_players || 0,
        error: queryResult.error || "Server query timed out",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
        },
      }
    );
  } catch (err) {
    console.error(`Error querying players for server ${id}:`, err);
    return NextResponse.json(
      { available: false, error: "Internal error querying server" },
      { status: 500 }
    );
  }
}
