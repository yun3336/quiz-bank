/**
 * 原生殼（Capacitor）偵測。
 * 網站部署預設不是原生殼；只有 Capacitor runtime 或建置旗標 NEXT_PUBLIC_NATIVE_SHELL=1。
 * 原生殼不含正解題庫；連線批改走 NEXT_PUBLIC_API_BASE。
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
