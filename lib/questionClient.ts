import { applyReveal, type GradeReveal } from "./questionPublic";
import type { Attempt, ProgressStore, Question } from "./types";
import type { LanguagePracticeMode } from "./practiceModes";
import type { DifficultyFilter } from "./questions";
import type { Vendor } from "./vendor";
import { apiUrl } from "./apiBase";
import { createPendingId } from "./pendingGrade";
import { queuePendingExam, queuePendingGrade } from "./pendingGradeStore";

const CATALOG_KEY = "quiz-bank:catalog-v1";

export const OFFLINE_GRADE_MESSAGE = "目前離線：作答已暫存為「待批改」，連線後會自動送交伺服端批改。";

export class OfflineGradeError extends Error {
  constructor(message = OFFLINE_GRADE_MESSAGE) {
    super(message);
    this.name = "OfflineGradeError";
  }
}

export type GradeRemoteResult =
  | {
      status: "graded";
      correct: boolean;
      question: Question;
      reveal: GradeReveal;
    }
  | {
      status: "pending";
      pendingId: string;
      question: Question;
      message: string;
    };

type CatalogCache = {
  all: Question[];
  byVendor: Partial<Record<Vendor, Question[]>>;
};

let memory: CatalogCache = { all: [], byVendor: {} };

function readCache(): CatalogCache {
  if (memory.all.length > 0) return memory;
  if (typeof window === "undefined") return memory;
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as CatalogCache;
    if (Array.isArray(parsed.all)) memory = { all: parsed.all, byVendor: parsed.byVendor ?? {} };
  } catch {
    /* ignore */
  }
  return memory;
}

function writeCache() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(memory));
  } catch {
    /* quota */
  }
}

function rememberCatalog(questions: Question[], vendor?: Vendor) {
  readCache();
  if (vendor) {
    memory.byVendor[vendor] = questions;
    const others = memory.all.filter((item) => !questions.some((next) => next.id === item.id));
    memory.all = [...others, ...questions];
  } else if (questions.length > 0) {
    memory.all = questions;
  }
  writeCache();
}

export function cachedCatalog(vendor?: Vendor): Question[] {
  const cache = readCache();
  if (vendor) return cache.byVendor[vendor] ?? cache.all.filter((item) => item.chapter);
  return cache.all;
}

/** 清除記憶體中的題目目錄快取（本機資料全清時一併呼叫）。 */
export function resetCatalogCache(): void {
  memory = { all: [], byVendor: {} };
}

export type VendorCatalogMeta = { vendor: Vendor; count: number; chapters: string[] };

export async function loadVendorCatalogMeta(): Promise<VendorCatalogMeta[]> {
  try {
    const response = await fetch(apiUrl("/api/catalog"));
    if (!response.ok) throw new Error("catalog-failed");
    const data = (await response.json()) as { vendors?: VendorCatalogMeta[] };
    return Array.isArray(data.vendors) ? data.vendors : [];
  } catch {
    return [];
  }
}

export async function loadCatalog(vendor?: Vendor): Promise<Question[]> {
  try {
    if (!vendor) {
      // 未指定 vendor 時 API 不回傳全庫題幹；請用 loadVendorCatalogMeta()
      return cachedCatalog();
    }
    const response = await fetch(apiUrl(`/api/catalog?vendor=${encodeURIComponent(vendor)}`));
    if (!response.ok) throw new Error("catalog-failed");
    const data = (await response.json()) as { questions?: Question[] };
    const questions = Array.isArray(data.questions) ? data.questions : [];
    rememberCatalog(questions, vendor);
    return memory.byVendor[vendor] ?? [];
  } catch {
    // 離線：只用先前快取的公開題（無正解）
    const cached = cachedCatalog(vendor);
    if (cached.length > 0) return cached;
    throw new Error("catalog-failed");
  }
}

export async function loadQuiz(body: {
  kind?: "practice" | "exam" | "today" | "ids";
  vendor: Vendor;
  chapter?: string;
  count?: number | "all";
  random?: boolean;
  method?: LanguagePracticeMode;
  difficulty?: DifficultyFilter;
  qid?: string;
  ids?: string[];
  store?: ProgressStore;
}): Promise<Question[]> {
  try {
    const response = await fetch(apiUrl("/api/quiz"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("quiz-failed");
    const data = (await response.json()) as { questions?: Question[] };
    return Array.isArray(data.questions) ? data.questions : [];
  } catch {
    // 離線：只能從本機公開快取按 ids／qid 取回已看過的題
    const pool = cachedCatalog(body.vendor);
    if (body.qid) {
      const hit = pool.find((item) => item.id === body.qid);
      return hit ? [hit] : [];
    }
    if (body.ids && body.ids.length > 0) {
      const set = new Set(body.ids);
      return pool.filter((item) => set.has(item.id));
    }
    if (pool.length === 0) throw new Error("quiz-failed");
    const count = typeof body.count === "number" ? body.count : Math.min(10, pool.length);
    return pool.slice(0, count);
  }
}

async function postGrade(body: unknown): Promise<Response> {
  try {
    return await fetch(apiUrl("/api/grade"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new OfflineGradeError();
  }
}

export async function gradeRemote(
  question: Question,
  selected: string[],
  options?: { peek?: boolean; strict?: boolean; mode?: "practice" | "exam" },
): Promise<GradeRemoteResult> {
  const mode = options?.mode ?? "practice";
  try {
    const clientRequestId = createPendingId();
    const response = await postGrade({
      questionId: question.id,
      selected,
      peek: options?.peek,
      mode: options?.strict ? "strict" : "loose",
      clientRequestId,
    });
    if (response.ok) {
      const data = (await response.json()) as { correct: boolean; reveal: GradeReveal };
      return {
        status: "graded",
        correct: data.correct,
        reveal: data.reveal,
        question: applyReveal(question, data.reveal),
      };
    }
    if (response.status === 0 || response.status >= 500 || response.status === 429) {
      throw new OfflineGradeError();
    }
    throw new Error("grade-failed");
  } catch (error) {
    if (error instanceof Error && error.message === "grade-failed") throw error;
    if (options?.peek) {
      // 偷看解析必須連線；不佇列假解析
      throw new OfflineGradeError("需連線才能看解析。");
    }
    const pending = queuePendingGrade({
      questionId: question.id,
      selected,
      mode,
      peek: options?.peek,
      strict: options?.strict,
      at: Date.now(),
    });
    return {
      status: "pending",
      pendingId: pending.id,
      question,
      message: OFFLINE_GRADE_MESSAGE,
    };
  }
}

export async function gradeExamRemote(
  items: { questionId: string; selected: string[] }[],
  meta?: { startedAt: number; durationSec: number; chapter: string; total: number },
): Promise<
  | { status: "graded"; results: { questionId: string; selected: string[]; correct: boolean; reveal: GradeReveal }[] }
  | { status: "pending"; pendingId: string; message: string }
> {
  try {
    const clientRequestId = createPendingId();
    const response = await postGrade({ items, clientRequestId });
    if (!response.ok) throw new OfflineGradeError();
    const data = (await response.json()) as {
      results: { questionId: string; correct: boolean; reveal: GradeReveal }[];
    };
    const byId = new Map((data.results ?? []).map((item) => [item.questionId, item]));
    return {
      status: "graded",
      results: items.map((item) => {
        const hit = byId.get(item.questionId);
        return {
          questionId: item.questionId,
          selected: item.selected,
          correct: hit?.correct ?? false,
          reveal: hit?.reveal ?? {
            explanation: "",
            revealText: "",
            lab: null,
          },
        };
      }),
    };
  } catch {
    const pending = queuePendingExam({
      items,
      startedAt: meta?.startedAt ?? Date.now(),
      durationSec: meta?.durationSec ?? 0,
      chapter: meta?.chapter ?? "",
      total: meta?.total ?? items.length,
      at: Date.now(),
    });
    return {
      status: "pending",
      pendingId: pending.id,
      message: OFFLINE_GRADE_MESSAGE,
    };
  }
}

export function resolveFromPool(id: string, pool: Question[]): Question | undefined {
  return pool.find((item) => item.id === id);
}

export function expandFromPool(picked: Question[], pool: Question[]): Question[] {
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

export function attemptVendorFilter(_attempts: Attempt[], pool: Question[]): Set<string> {
  return new Set(pool.map((item) => item.id));
}
