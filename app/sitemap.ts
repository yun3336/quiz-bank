import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Only routes that already return HTTP 200 on production. */
const PUBLIC_PATHS = ["/", "/practice", "/review", "/stats", "/exam", "/lab"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    // Match Next.js metadataBase canonical form (no trailing slash on home).
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
  }));
}
