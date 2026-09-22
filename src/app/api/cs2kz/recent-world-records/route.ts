import { KzRecord, Mode, Page } from "@/lib/types";

const API_BASE_URL = "https://api.cs2kz.org";
const CACHE_SECONDS = 5 * 60;

function parseMode(value: string | null): Mode {
  return value === "vanilla" ? "vanilla" : "classic";
}

export async function GET(request: Request) {
  const mode = parseMode(new URL(request.url).searchParams.get("mode"));
  const params = new URLSearchParams({
    mode,
    top: "true",
    max_rank: "1",
    limit: "5",
    offset: "0",
  });

  try {
    const response = await fetch(`${API_BASE_URL}/records?${params.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: CACHE_SECONDS, tags: [`recent-world-records-${mode}`] },
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      throw new Error(`CS2KZ request failed (${response.status})`);
    }

    const page = (await response.json()) as Page<KzRecord>;
    const records = Array.isArray(page.values) ? page.values.slice(0, 5) : [];

    return Response.json(
      { records },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`,
        },
      }
    );
  } catch (error) {
    console.error("Failed to load recent world records:", error);
    return Response.json(
      { records: [] },
      { status: 502, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
