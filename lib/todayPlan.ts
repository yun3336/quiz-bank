import type { Attempt, ProgressStore, Question } from "./types";
import { dayKey, isDueWrong } from "./wrongBook";

export { dayKey };

export const DAILY_GOALS = [10, 20, 30] as const;
export type DailyGoal = (typeof DAILY_GOALS)[number];
export const DEFAULT_DAILY_GOAL = 10;

export type TodayPick = {
  questions: Question[];
  fromWrong: number;
  fromWeak: number;
  fromFresh: number;
};

export function parseDailyGoal(value: unknown): DailyGoal {
  const n = Number(value);
  return DAILY_GOALS.includes(n as DailyGoal) ? (n as DailyGoal) : DEFAULT_DAILY_GOAL;
}

export function todayAttemptCount(attempts: Attempt[], now = Date.now()): number {
  const today = dayKey(now);
  return attempts.filter((item) => dayKey(item.at) === today).length;
}

export function todaySessionSize(goal: number, done: number): number {
  const remaining = goal - done;
  return remaining > 0 ? remaining : goal;
}

export function pickTodayQuiz(options: {
  store: ProgressStore;
  pool: Question[];
  count: number;
  now?: number;
  random?: boolean;
}): TodayPick {
  const { store, pool, now = Date.now(), random = true } = options;
  const count = Math.max(0, options.count);
  const empty: TodayPick = { questions: [], fromWrong: 0, fromWeak: 0, fromFresh: 0 };
  if (count === 0 || pool.length === 0) return empty;

  const used = new Set<string>();
  const result: Question[] = [];
  let fromWrong = 0;
  let fromWeak = 0;
  let fromFresh = 0;
  const today = dayKey(now);
  const attempted = new Set(store.attempts.map((item) => item.questionId));
  const attemptedToday = new Set(
    store.attempts.filter((item) => dayKey(item.at) === today).map((item) => item.questionId),
  );
  const lastAt = latestAttemptAt(store.attempts);

  function addGroup(question: Question, source: "wrong" | "weak" | "fresh"): boolean {
    if (result.length >= count || used.has(question.id)) return result.length >= count;
    const group = expandFromPool([question], pool).filter((item) => !used.has(item.id));
    for (const item of group) {
      used.add(item.id);
      result.push(item);
      if (source === "wrong") fromWrong += 1;
      else if (source === "weak") fromWeak += 1;
      else fromFresh += 1;
    }
    return result.length >= count;
  }

  function addMany(items: Question[], source: "wrong" | "weak" | "fresh"): boolean {
    for (const item of items) {
      if (addGroup(item, source)) return true;
    }
    return result.length >= count;
  }

  const wrongs = dueWrongsInPool(store, pool, now).sort((left, right) => {
    return (lastAt.get(left.id) ?? 0) - (lastAt.get(right.id) ?? 0);
  });
  if (addMany(wrongs, "wrong")) {
    return { questions: result, fromWrong, fromWeak, fromFresh };
  }

  for (const chapter of weakChapters(store, pool)) {
    const inChapter = pool.filter((item) => item.chapter === chapter && !used.has(item.id));
    const unseen = inChapter.filter((item) => !attempted.has(item.id));
    const rest = inChapter.filter((item) => attempted.has(item.id) && !attemptedToday.has(item.id));
    const ordered = random ? [...shuffle(unseen), ...shuffle(rest)] : [...unseen, ...rest];
    if (addMany(ordered, "weak")) {
      return { questions: result, fromWrong, fromWeak, fromFresh };
    }
  }

  const leftover = pool.filter((item) => !used.has(item.id) && !attemptedToday.has(item.id));
  const unseen = leftover.filter((item) => !attempted.has(item.id));
  const rest = leftover.filter((item) => attempted.has(item.id));
  const ordered = random ? [...shuffle(unseen), ...shuffle(rest)] : [...unseen, ...rest];
  addMany(ordered, "fresh");

  return { questions: result, fromWrong, fromWeak, fromFresh };
}

function latestAttemptAt(attempts: Attempt[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const attempt of attempts) {
    map.set(attempt.questionId, attempt.at);
  }
  return map;
}

function dueWrongsInPool(store: ProgressStore, pool: Question[], now: number): Question[] {
  const ids = [...new Set(store.attempts.map((item) => item.questionId))].filter((id) =>
    isDueWrong(store.attempts, id, now),
  );
  const byId = new Map(pool.map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)).filter((item): item is Question => Boolean(item));
}

function weakChapters(store: ProgressStore, pool: Question[]): string[] {
  const stats = new Map<string, { attempts: number; correct: number }>();
  for (const question of pool) {
    if (!stats.has(question.chapter)) stats.set(question.chapter, { attempts: 0, correct: 0 });
  }
  const chapterOf = new Map(pool.map((item) => [item.id, item.chapter]));
  for (const attempt of store.attempts) {
    const chapter = chapterOf.get(attempt.questionId);
    if (!chapter) continue;
    const current = stats.get(chapter);
    if (!current) continue;
    current.attempts += 1;
    if (attempt.correct) current.correct += 1;
  }
  return [...stats.entries()]
    .map(([chapter, value]) => ({
      chapter,
      attempts: value.attempts,
      accuracy: value.attempts === 0 ? 1 : value.correct / value.attempts,
    }))
    .filter((item) => item.attempts > 0 && item.accuracy < 1)
    .sort((left, right) => left.accuracy - right.accuracy || left.chapter.localeCompare(right.chapter, "zh-Hant"))
    .map((item) => item.chapter);
}

function expandFromPool(picked: Question[], pool: Question[]): Question[] {
  const result: Question[] = [];
  const usedPassage = new Set<string>();
  const usedId = new Set<string>();
  for (const question of picked) {
    if (question.passageId) {
      if (usedPassage.has(question.passageId)) continue;
      usedPassage.add(question.passageId);
      for (const item of pool) {
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

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}
