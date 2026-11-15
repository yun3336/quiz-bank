/**
 * 程序內簡易速率限制（單一 Node 實例記憶體）。
 *
 * 限制（請在文件如實揭露）：
 * - 無登入／無分散式儲存時，多實例、多 IP、重啟後都會失效或不一致
 * - 不能當成防爬／防濫用的完整方案；只是降低單一連線的粗暴批量請求
 */
export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (current.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { ok: true };
}

/** 測試用：清空記憶體桶。 */
export function resetRateLimitBuckets(): void {
  buckets.clear();
}

export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return `ip:${first}`;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return `ip:${realIp}`;
  return "ip:unknown";
}
