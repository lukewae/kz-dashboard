/**
 * Steam OpenID 2.0 Authentication Helper Utilities
 * Runs serverless in Next.js / Vercel with zero external OAuth dependencies.
 */

const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";

/**
 * Converts a 64-bit Steam ID (e.g. "76561198085260560") into SteamID2 format ("STEAM_1:0:62497416").
 */
export function steam64ToSteam2(steam64: string): string {
  try {
    const id = BigInt(steam64);
    const base = BigInt("76561197960265728");
    if (id < base) return steam64;
    const diff = id - base;
    const y = diff % BigInt(2);
    const z = diff / BigInt(2);
    return `STEAM_1:${y.toString()}:${z.toString()}`;
  } catch {
    return steam64;
  }
}

/**
 * Converts SteamID2 format ("STEAM_1:0:62497416") back into 64-bit Steam ID ("76561198085260560").
 */
export function steam2ToSteam64(steam2: string): string {
  try {
    const parts = steam2.split(":");
    if (parts.length === 3) {
      const y = BigInt(parts[1]);
      const z = BigInt(parts[2]);
      const base = BigInt("76561197960265728");
      const id = base + (z * BigInt(2)) + y;
      return id.toString();
    }
    return steam2;
  } catch {
    return steam2;
  }
}

/**
 * Builds the Steam OpenID 2.0 authorization redirect URL.
 */
export function buildSteamLoginUrl(returnToUrl: string, realmUrl: string): string {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnToUrl,
    "openid.realm": realmUrl,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });

  return `${STEAM_OPENID_URL}?${params.toString()}`;
}

/**
 * Validates the OpenID response returned by Valve.
 * Sends a direct server-to-server POST request to Valve to verify signatures.
 */
export async function verifySteamOpenIdResponse(
  searchParams: Record<string, string>
): Promise<{ isValid: boolean; steamId64: string | null; steamId2: string | null }> {
  try {
    const claimedId = searchParams["openid.claimed_id"] || searchParams["openid.identity"] || "";
    const steam64Match = claimedId.match(/\/id\/(\d+)$/);
    if (!steam64Match) {
      return { isValid: false, steamId64: null, steamId2: null };
    }

    const steamId64 = steam64Match[1];

    // Construct validation payload
    const validationParams = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key.startsWith("openid.")) {
        validationParams.set(key, value);
      }
    }
    validationParams.set("openid.mode", "check_authentication");

    const response = await fetch(STEAM_OPENID_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: validationParams.toString(),
    });

    if (!response.ok) {
      return { isValid: false, steamId64: null, steamId2: null };
    }

    const text = await response.text();
    const isValid = text.includes("is_valid:true");

    return {
      isValid,
      steamId64: isValid ? steamId64 : null,
      steamId2: isValid ? steam64ToSteam2(steamId64) : null,
    };
  } catch (error) {
    console.error("Failed to verify Steam OpenID response:", error);
    return { isValid: false, steamId64: null, steamId2: null };
  }
}
