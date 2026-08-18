import { NextRequest, NextResponse } from "next/server";
import { buildSteamLoginUrl } from "@/lib/steamAuth";

export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const returnUrl = `${origin}/api/auth/steam/callback`;
  const realmUrl = `${origin}/`;

  const steamLoginUrl = buildSteamLoginUrl(returnUrl, realmUrl);

  return NextResponse.redirect(steamLoginUrl);
}
