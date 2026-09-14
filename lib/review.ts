import { questionTypeLabel } from "./grade";
import { shuffle } from "./questions";
import type { Attempt, ProgressStore, Question } from "./types";
import { questionVendor, type Vendor } from "./vendor";
import {
  consecutiveCorrect,
  dayKey,
  isOpenWrong,
  WRONG_CLEAR_STREAK,
  wrongDueDay,
} from "./wrongBook";

export type ReviewTab = "wrong" | "starred" | "noted";

export {
  consecutiveCorrect,
  isOpenWrong,
  WRONG_CLEAR_STREAK,
  wrongDueDay,
};
export { dueLabel, isDueWrong } from "./wrongBook";

export interface ReviewItem {
  question: Question;
  lastAt: number;
  lastCorrect: boolean;
  wrongCount: number;
  attemptCount: number;
  streak: number;
  needed: number;
  dueDay: string | null;
  due: boolean;
}

export function latestAttemptMap(attempts: Attempt[]): Map<string, Attempt> {
  const map = new Map<string, Attempt>();
  for (const attempt of attempts) {
    map.set(attempt.questionId, attempt);
  }
  return map;
}

function tallyAttempts(attempts: Attempt[]): Map<string, { attempts: number; wrongs: number }> {
  const counts = new Map<string, { attempts: number; wrongs: number }>();
  for (const attempt of attempts) {
    const current = counts.get(attempt.questionId) ?? { attempts: 0, wrongs: 0 };
    current.attempts += 1;
    if (!attempt.correct) current.wrongs += 1;
    counts.set(attempt.questionId, current);
  }
  return counts;
}

export function reviewItems(
  store: ProgressStore,
  vendor: Vendor,
  tab: ReviewTab,
  pool: Question[],
  now = Date.now(),
): ReviewItem[] {
  const byId = new Map(pool.map((item) => [item.id, item]));
  const latest = latestAttemptMap(store.attempts);
  const counts = tallyAttempts(store.attempts);
  const today = dayKey(now);
  function resolve(id: string): Question | undefined {
    return byId.get(id);
  }
  const ids =
    tab === "starred"
      ? store.starredIds.filter((id) => {
          const question = resolve(id);
          return Boolean(question && questionVendor(question) === vendor);
        })
      : tab === "noted"
        ? Object.entries(store.notes ?? {})
            .filter(([, text]) => typeof text === "string" && text.trim().length > 0)
            .map(([id]) => id)
            .filter((id) => {
              const question = resolve(id);
              return Boolean(question && questionVendor(question) === vendor);
            })
        : [...new Set(store.attempts.map((attempt) => attempt.questionId))].filter((id) => {
          if (!isOpenWrong(store.attempts, id)) return false;
          const question = resolve(id);
          return Boolean(question && questionVendor(question) === vendor);
        });

  return ids
    .map((id) => {
      const question = resolve(id);
      if (!question) return null;
      const last = latest.get(id);
      const tally = counts.get(id) ?? { attempts: 0, wrongs: 0 };
      const streak = consecutiveCorrect(store.attempts, id);
      const dueDay = tab === "wrong" ? wrongDueDay(store.attempts, id) : null;
      const due = dueDay != null && dueDay <= today;
      return {
        question,
        lastAt: last?.at ?? 0,
        lastCorrect: last?.correct ?? true,
        wrongCount: tally.wrongs,
        attemptCount: tally.attempts,
        streak,
        needed: Math.max(0, WRONG_CLEAR_STREAK - streak),
        dueDay,
        due,
      };
    })
    .filter((item): item is ReviewItem => Boolean(item))
    .sort((a, b) => {
      if (tab === "starred") return b.lastAt - a.lastAt;
      if (a.due !== b.due) return a.due ? -1 : 1;
      if (a.dueDay && b.dueDay && a.dueDay !== b.dueDay) return a.dueDay.localeCompare(b.dueDay);
      return b.lastAt - a.lastAt;
    });
}

export function openWrongCount(store: ProgressStore, vendor: Vendor, pool: Question[]): number {
  return reviewItems(store, vendor, "wrong", pool).length;
}

export function dueWrongCount(store: ProgressStore, vendor: Vendor, pool: Question[], now = Date.now()): number {
  return reviewItems(store, vendor, "wrong", pool, now).filter((item) => item.due).length;
}

export function expandForReview(picked: Question[], pool: Question[]): Question[] {
  const all = pool;
  const result: Question[] = [];
  const usedPassage = new Set<string>();
  const usedId = new Set<string>();
  for (const question of picked) {
    if (question.passageId) {
      if (usedPassage.has(question.passageId)) continue;
      usedPassage.add(question.passageId);
      for (const item of all) {
        if (item.passageId === question.passageId && !usedId.has(item.id)) {
          usedId.add(item.id);
          result.push(item);
        }
      }
      continue;
    }
    if (!usedId.has(question.id)) {
      usedId.add(question.id);
      result.push(question);
    }
  }
  return result;
}

export function pickReviewQuiz(
  items: ReviewItem[],
  count: number | "all",
  random: boolean,
  pool: Question[],
): Question[] {
  const due = items.filter((item) => item.due);
  const later = items.filter((item) => !item.due);
  const ordered = random ? [...shuffle(due), ...shuffle(later)] : [...due, ...later];
  const base = ordered.map((item) => item.question);
  const sliced = count === "all" ? base : base.slice(0, Math.min(count, base.length));
  return expandForReview(sliced, pool);
}

export function reviewTypeLabel(question: Question): string {
  return questionTypeLabel(question.type);
}
