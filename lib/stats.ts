import type { ProgressStore } from "./types";
import { chapterVendor, type Vendor } from "./vendor";

export type QuestionMeta = { id: string; chapter: string };

export interface ChapterStat {
  chapter: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface OverviewStat {
  totalAttempts: number;
  correct: number;
  accuracy: number;
  examCount: number;
}

function idSet(vendor?: Vendor, metas: QuestionMeta[] = []): Set<string> | null {
  if (!vendor) return null;
  return new Set(metas.filter((item) => chapterVendor(item.chapter) === vendor).map((item) => item.id));
}

export function getOverview(store: ProgressStore, vendor?: Vendor, metas: QuestionMeta[] = []): OverviewStat {
  const allowed = idSet(vendor, metas);
  const attempts = allowed
    ? store.attempts.filter((attempt) => allowed.has(attempt.questionId))
    : store.attempts;
  const totalAttempts = attempts.length;
  const correct = attempts.filter((item) => item.correct).length;
  const examCount = vendor
    ? store.examHistory.filter((exam) => chapterVendor(exam.chapter ?? "") === vendor).length
    : store.examHistory.length;
  return {
    totalAttempts,
    correct,
    accuracy: totalAttempts === 0 ? 0 : correct / totalAttempts,
    examCount,
  };
}

export function getChapterStats(store: ProgressStore, vendor?: Vendor, metas: QuestionMeta[] = []): ChapterStat[] {
  const pool = vendor ? metas.filter((item) => chapterVendor(item.chapter) === vendor) : metas;
  const byChapter = new Map<string, { attempts: number; correct: number }>();
  const questionChapter = new Map(pool.map((item) => [item.id, item.chapter]));
  const chapters = [...new Set(pool.map((item) => item.chapter))];

  for (const chapter of chapters) {
    byChapter.set(chapter, { attempts: 0, correct: 0 });
  }

  for (const attempt of store.attempts) {
    const chapter = questionChapter.get(attempt.questionId);
    if (!chapter) continue;
    const current = byChapter.get(chapter);
    if (!current) continue;
    current.attempts += 1;
    if (attempt.correct) current.correct += 1;
  }

  return [...byChapter.entries()]
    .map(([chapter, value]) => ({
      chapter,
      attempts: value.attempts,
      correct: value.correct,
      accuracy: value.attempts === 0 ? 0 : value.correct / value.attempts,
    }))
    .sort((a, b) => {
      if (a.attempts === 0 && b.attempts === 0) return a.chapter.localeCompare(b.chapter, "zh-Hant");
      if (a.attempts === 0) return 1;
      if (b.attempts === 0) return -1;
      return a.accuracy - b.accuracy;
    });
}

export function getRecentExams(store: ProgressStore, limit = 7) {
  return [...store.examHistory].sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
}

export interface StudyStreak {
  current: number;
  best: number;
  studiedToday: boolean;
}

function dayKey(at: number): string {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function shiftDay(key: string, delta: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return dayKey(new Date(year, month - 1, day + delta).getTime());
}

function longestRun(sortedDays: string[]): number {
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sortedDays) {
    run = previous && day === shiftDay(previous, 1) ? run + 1 : 1;
    if (run > best) best = run;
    previous = day;
  }
  return best;
}

export function getStudyStreak(store: ProgressStore, vendor?: Vendor, metas: QuestionMeta[] = []): StudyStreak {
  const allowed = idSet(vendor, metas);
  const days = new Set<string>();

  for (const attempt of store.attempts) {
    if (allowed && !allowed.has(attempt.questionId)) continue;
    days.add(dayKey(attempt.at));
  }
  for (const exam of store.examHistory) {
    if (vendor && chapterVendor(exam.chapter ?? "") !== vendor) continue;
    days.add(dayKey(exam.startedAt));
  }

  const sorted = [...days].sort();
  const today = dayKey(Date.now());
  const studiedToday = days.has(today);
  const anchor = studiedToday ? today : shiftDay(today, -1);
  let current = 0;
  let cursor = anchor;
  while (days.has(cursor)) {
    current += 1;
    cursor = shiftDay(cursor, -1);
  }

  return { current, best: longestRun(sorted), studiedToday };
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
