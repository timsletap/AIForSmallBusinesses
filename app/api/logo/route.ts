import { fetchWithTimeout } from "@/lib/llm/provider";

export const runtime = "nodejs";

const DOMAIN = /^(?=.{3,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,24}$/;

/**
 * Vendor logo (the site's own icon, via Google's favicon cache) served from our domain and cached
 * at the edge for a week, so visitors' browsers don't call third parties directly.
 */
export async function GET(req: Request) {
  const d = new URL(req.url).searchParams.get("d")?.toLowerCase() ?? "";
  if (!DOMAIN.test(d)) return new Response("bad domain", { status: 400 });
  try {
    const res = await fetchWithTimeout(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`, {}, 8000);
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return new Response("not found", { status: 404 });
    return new Response(await res.arrayBuffer(), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
