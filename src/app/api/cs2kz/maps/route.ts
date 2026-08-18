import { NextRequest, NextResponse } from "next/server"; import { cs2kzProvider } from "@/lib/providers/cs2kz";
export async function GET(request:NextRequest){const query=request.nextUrl.searchParams.get("q")??"";try{return NextResponse.json(await cs2kzProvider.searchMaps(query))}catch{return NextResponse.json({error:"CS2KZ API unavailable"},{status:502})}}
