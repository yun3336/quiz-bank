/** 抓題／批改批量上限（與 rateLimit 搭配；非登入防護）。 */
export const MAX_QUIZ_COUNT = 40;
export const MAX_QUIZ_IDS = 40;
export const MAX_GRADE_BATCH = 40;
export const MAX_CATALOG_QUESTIONS = 500;

export const RATE_CATALOG_PER_MIN = 30;
export const RATE_QUIZ_PER_MIN = 30;
export const RATE_GRADE_PER_MIN = 60;
export const RATE_WINDOW_MS = 60_000;

export function clampQuizCount(count: number | "all" | undefined, fallback = 10): number | "all" {
  if (count === "all") return MAX_QUIZ_COUNT;
  if (typeof count !== "number" || !Number.isFinite(count)) return fallback;
  return Math.max(1, Math.min(MAX_QUIZ_COUNT, Math.floor(count)));
}
