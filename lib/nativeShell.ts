/**
 * 原生殼（Capacitor）偵測。
 * 網站部署預設不是原生殼；只有 Capacitor runtime 或建置旗標 NEXT_PUBLIC_NATIVE_SHELL=1。
 */

export function isNativeShell(): boolean {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_NATIVE_SHELL === "1") {
    return true;
  }
  if (typeof window === "undefined") return false;
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/** 離線完整題庫 JSON 路徑（只應出現在 Capacitor www，不應出現在 Vercel public）。 */
export const OFFLINE_BANK_URL = "/offline-bank.json";
