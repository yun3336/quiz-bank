/**
 * API 基底。網站相對路徑為空；原生靜態殼建置時設 NEXT_PUBLIC_API_BASE
 * 指向可連線的網站後端（只用於 catalog／quiz／grade，不是把整個 App 做成遠端 WebView）。
 */
export function apiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
