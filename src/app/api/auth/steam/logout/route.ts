import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete("cs2kz_steam_id");
  return res;
}

export async function GET() {
  const res = NextResponse.redirect("/");
  res.cookies.delete("cs2kz_steam_id");
  return res;
}
