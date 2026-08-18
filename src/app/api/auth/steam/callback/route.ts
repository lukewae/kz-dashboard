import { NextRequest, NextResponse } from "next/server";
import { verifySteamOpenIdResponse } from "@/lib/steamAuth";

export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const searchParamsRecord: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((val, key) => {
    searchParamsRecord[key] = val;
  });

  const { isValid, steamId2 } = await verifySteamOpenIdResponse(searchParamsRecord);

  if (!isValid || !steamId2) {
    return NextResponse.redirect(`${origin}/?auth_error=steam_verification_failed`);
  }

  // Set auth cookie and redirect back to homepage (or redirect with client hook param)
  const res = NextResponse.redirect(`${origin}/?login_success=1`);
  res.cookies.set("cs2kz_steam_id", steamId2, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    httpOnly: false, // Accessible to client-side react hook
  });

  return res;
}
