import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "題庫刷題",
    short_name: "題庫",
    description: "計算機、語言、數學、自然科學與職場證照刷題，進度存在本機。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3faf8",
    theme_color: "#00686b",
    lang: "zh-Hant",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
