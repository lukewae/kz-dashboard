import dgram from "dgram";
import dns from "dns/promises";

export interface A2SPlayer {
  index: number;
  name: string;
  score: number;
  duration: number; // Seconds connected
  isAnonymous?: boolean;
}

export interface A2SPlayerQueryResult {
  success: boolean;
  count: number;
  namedCount: number;
  anonymousCount: number;
  players: A2SPlayer[];
  isNamesHidden?: boolean;
  error?: string;
}

/**
 * Queries a Source engine dedicated game server for active players using Valve A2S_PLAYER protocol over UDP.
 */
export async function queryServerPlayers(
  host: string,
  port: number,
  timeoutMs: number = 3000
): Promise<A2SPlayerQueryResult> {
  return new Promise(async (resolve) => {
    let socket: dgram.Socket | null = null;
    let timer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (socket) {
        try {
          socket.close();
        } catch {
          // ignore close errors
        }
        socket = null;
      }
    };

    try {
      let targetIp = host;
      try {
        const lookup = await dns.lookup(host);
        targetIp = lookup.address;
      } catch {
        // Use as-is if already IP or lookup failed
      }

      socket = dgram.createSocket("udp4");

      timer = setTimeout(() => {
        cleanup();
        resolve({
          success: false,
          count: 0,
          namedCount: 0,
          anonymousCount: 0,
          players: [],
          error: "Query timed out or server refused player list",
        });
      }, timeoutMs);

      socket.on("error", (err) => {
        cleanup();
        resolve({
          success: false,
          count: 0,
          namedCount: 0,
          anonymousCount: 0,
          players: [],
          error: err.message,
        });
      });

      socket.on("message", (msg) => {
        if (msg.length < 5) return;
        const header = msg.readInt32LE(0);
        if (header !== -1) return; // Must be 0xFFFFFFFF (-1 in 32-bit int)

        const type = msg.readUInt8(4);

        // Challenge Response: 0x41 ('A')
        if (type === 0x41 && msg.length >= 9) {
          const challenge = msg.subarray(5, 9);
          // Send A2S_PLAYER request with received challenge
          const reqWithChallenge = Buffer.concat([
            Buffer.from([0xff, 0xff, 0xff, 0xff, 0x55]),
            challenge,
          ]);
          if (socket) {
            socket.send(reqWithChallenge, port, targetIp);
          }
          return;
        }

        // Player Response: 0x44 ('D')
        if (type === 0x44) {
          cleanup();
          try {
            const numPlayers = msg.readUInt8(5);
            let offset = 6;
            const namedPlayers: A2SPlayer[] = [];
            let anonymousCount = 0;

            for (let i = 0; i < numPlayers && offset < msg.length; i++) {
              const playerIndex = msg.readUInt8(offset++);
              
              // Read null-terminated string name
              let nameEnd = offset;
              while (nameEnd < msg.length && msg[nameEnd] !== 0) {
                nameEnd++;
              }
              const rawName = msg.toString("utf8", offset, nameEnd).trim();
              offset = nameEnd + 1;

              if (offset + 8 <= msg.length) {
                const score = msg.readInt32LE(offset);
                offset += 4;
                const duration = msg.readFloatLE(offset);
                offset += 4;

                const isPlaceholder = !rawName || rawName.toLowerCase() === "connected player";

                if (isPlaceholder) {
                  anonymousCount++;
                } else {
                  namedPlayers.push({
                    index: playerIndex,
                    name: rawName,
                    score,
                    duration: Math.max(0, Math.floor(duration)),
                    isAnonymous: false,
                  });
                }
              }
            }

            // Sort named players by longest connected duration first
            namedPlayers.sort((a, b) => b.duration - a.duration);

            const isNamesHidden = namedPlayers.length === 0 && anonymousCount > 0;

            resolve({
              success: true,
              count: namedPlayers.length + anonymousCount,
              namedCount: namedPlayers.length,
              anonymousCount,
              players: namedPlayers,
              isNamesHidden,
            });
          } catch (parseErr) {
            resolve({
              success: false,
              count: 0,
              namedCount: 0,
              anonymousCount: 0,
              players: [],
              error: parseErr instanceof Error ? parseErr.message : "Failed to parse player packet",
            });
          }
        }
      });

      // Initial A2S_PLAYER challenge request: 0xFF 0xFF 0xFF 0xFF 0x55 0xFF 0xFF 0xFF 0xFF
      const initialPacket = Buffer.from([
        0xff, 0xff, 0xff, 0xff, 0x55, 0xff, 0xff, 0xff, 0xff,
      ]);
      socket.send(initialPacket, port, targetIp);
    } catch (err) {
      cleanup();
      resolve({
        success: false,
        count: 0,
        namedCount: 0,
        anonymousCount: 0,
        players: [],
        error: err instanceof Error ? err.message : "Socket initialization error",
      });
    }
  });
}
