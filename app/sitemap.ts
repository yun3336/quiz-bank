import type { MetadataRoute } from "next";
import { SITE_HOME_URL, SITE_URL } from "@/lib/site";

/** Only routes that already return HTTP 200 on production. */
const PUBLIC_PATHS = ["/", "/practice", "/review", "/stats", "/exam", "/lab", "/contact"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    // Homepage uses trailing slash to match GSC inspection URL; inner pages stay no-slash.
    url: path === "/" ? SITE_HOME_URL : `${SITE_URL}${path}`,
  }));
}
