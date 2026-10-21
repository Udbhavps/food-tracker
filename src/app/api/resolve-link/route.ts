import { NextResponse, type NextRequest } from "next/server";
import { isAllowedRedirectTarget, parseLink } from "@/lib/places/link";

/**
 * Expands a Google Maps short link (maps.app.goo.gl) to the full URL so the browser can read the place from it.
 * Redirects are followed by hand, only to Google hosts, at most 4 hops, so this cannot be used to reach other sites.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url") ?? "";
  const parsed = parseLink(raw);
  if (parsed.kind !== "maps-short") return NextResponse.json({ error: "not_a_short_maps_link" }, { status: 400 });

  let current = new URL(parsed.url);
  for (let hop = 0; hop < 4; hop++) {
    if (!isAllowedRedirectTarget(current)) return NextResponse.json({ error: "blocked" }, { status: 400 });
    let res: Response;
    try {
      res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(5000), headers: { "user-agent": "Mozilla/5.0" } });
    } catch {
      return NextResponse.json({ error: "unreachable" }, { status: 502 });
    }
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      try {
        current = new URL(loc, current);
      } catch {
        return NextResponse.json({ error: "bad_redirect" }, { status: 502 });
      }
      const p = parseLink(current.toString());
      if (p.kind === "maps") return NextResponse.json({ url: p.url });
      continue;
    }
    break;
  }
  return NextResponse.json({ error: "could_not_resolve" }, { status: 422 });
}
