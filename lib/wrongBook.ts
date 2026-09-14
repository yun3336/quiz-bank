import type { Attempt } from "./types";

/** Days to wait after 0 / 1 / 2 consecutive correct reviews. */
export const SRS_INTERVALS = [1, 3, 7] as const;

/** Consecutive correct reviews required to leave the wrong book. */
export const WRONG_CLEAR_STREAK = SRS_INTERVALS.length;

export function dayKey(at: number): string {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function shiftDay(key: string, delta: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return dayKey(new Date(year, month - 1, day + delta).getTime());
}

export function consecutiveCorrect(attempts: Attempt[], questionId: string): number {
  let streak = 0;
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    const attempt = attempts[index];
    if (attempt.questionId !== questionId) continue;
    if (!attempt.correct) break;
    streak += 1;
  }
  return streak;
}

export function isOpenWrong(attempts: Attempt[], questionId: string): boolean {
  let everWrong = false;
  for (const attempt of attempts) {
    if (attempt.questionId !== questionId) continue;
    if (!attempt.correct) everWrong = true;
  }
  if (!everWrong) return false;
  return consecutiveCorrect(attempts, questionId) < WRONG_CLEAR_STREAK;
}

export function lastAttemptAt(attempts: Attempt[], questionId: string): number | null {
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (attempts[index].questionId === questionId) return attempts[index].at;
  }
  return null;
}

export function wrongDueDay(attempts: Attempt[], questionId: string): string | null {
  if (!isOpenWrong(attempts, questionId)) return null;
  const at = lastAttemptAt(attempts, questionId);
  if (at == null) return null;
  const streak = consecutiveCorrect(attempts, questionId);
  const interval = SRS_INTERVALS[Math.min(streak, SRS_INTERVALS.length - 1)];
  return shiftDay(dayKey(at), interval);
}

export function isDueWrong(attempts: Attempt[], questionId: string, now = Date.now()): boolean {
  const due = wrongDueDay(attempts, questionId);
  return due != null && due <= dayKey(now);
}

export function daysUntil(dueDay: string, now = Date.now()): number {
  const today = dayKey(now);
  if (dueDay <= today) return 0;
  let days = 0;
  let cursor = today;
  while (cursor < dueDay && days < 366) {
    cursor = shiftDay(cursor, 1);
    days += 1;
  }
  return days;
}

export function dueLabel(dueDay: string, now = Date.now()): string {
  const days = daysUntil(dueDay, now);
  if (days <= 0) return "已到期";
  if (days === 1) return "明天";
  return `${days} 天後`;
}
