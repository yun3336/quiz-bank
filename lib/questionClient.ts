import { applyReveal, type GradeReveal } from "./questionPublic";
import type { Attempt, ProgressStore, Question } from "./types";
import type { LanguagePracticeMode } from "./practiceModes";
import type { DifficultyFilter } from "./questions";
import type { Vendor } from "./vendor";
import {
  canUseOfflineBank,
  getOfflineFullQuestion,
  loadOfflineCatalog,
  loadOfflineQuiz,
  resetOfflineBankCache,
} from "./offlineBank";
import { canGradeOffline, gradeOffline } from "./offlineGrade";

const CATALOG_KEY = "quiz-bank:catalog-v1";

export const OFFLINE_GRADE_MESSAGE = "需連線批改";
export const OFFLINE_UNSUPPORTED_MESSAGE =
  "此題離線無法批改（缺本機題庫或題型不支援），請連線後再試。";

export class OfflineGradeError extends Error {
  constructor(message = OFFLINE_GRADE_MESSAGE) {
    super(message);
    this.name = "OfflineGradeError";
  }
}

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
  resetOfflineBankCache();
}

export async function loadCatalog(vendor?: Vendor): Promise<Question[]> {
  try {
    const query = vendor ? `?vendor=${encodeURIComponent(vendor)}` : "";
    const response = await fetch(`/api/catalog${query}`);
    if (!response.ok) throw new Error("catalog-failed");
    const data = (await response.json()) as { questions?: Question[]; vendors?: { vendor: Vendor; count: number }[] };
    const questions = Array.isArray(data.questions) ? data.questions : [];
    rememberCatalog(questions, vendor);
    return vendor ? memory.byVendor[vendor] ?? [] : memory.all;
  } catch {
    if (!(await canUseOfflineBank())) throw new Error("catalog-failed");
    const questions = await loadOfflineCatalog(vendor);
    rememberCatalog(questions, vendor);
    return questions;
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
    const response = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("quiz-failed");
    const data = (await response.json()) as { questions?: Question[] };
    return Array.isArray(data.questions) ? data.questions : [];
  } catch {
    if (!(await canUseOfflineBank())) throw new Error("quiz-failed");
    return loadOfflineQuiz(body);
  }
}

async function postGrade(body: unknown): Promise<Response> {
  try {
    return await fetch("/api/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new OfflineGradeError();
  }
}

async function gradeWithOfflinePack(
  question: Question,
  selected: string[],
  options?: { peek?: boolean; strict?: boolean },
): Promise<{ correct: boolean; question: Question; reveal: GradeReveal }> {
  if (!(await canUseOfflineBank())) throw new OfflineGradeError();
  const full = getOfflineFullQuestion(question.id);
  if (!full || !canGradeOffline(full)) {
    throw new OfflineGradeError(OFFLINE_UNSUPPORTED_MESSAGE);
  }
  const result = gradeOffline(full, selected, options);
  return {
    correct: result.correct,
    reveal: result.reveal,
    question: applyReveal(question, result.reveal),
  };
}

export async function gradeRemote(
  question: Question,
  selected: string[],
  options?: { peek?: boolean; strict?: boolean },
): Promise<{ correct: boolean; question: Question; reveal: GradeReveal }> {
  try {
    const response = await postGrade({
      questionId: question.id,
      selected,
      peek: options?.peek,
      mode: options?.strict ? "strict" : "loose",
    });
    if (response.ok) {
      const data = (await response.json()) as { correct: boolean; reveal: GradeReveal };
      return {
        correct: data.correct,
        reveal: data.reveal,
        question: applyReveal(question, data.reveal),
      };
    }
    if (response.status === 0 || response.status >= 500) {
      return gradeWithOfflinePack(question, selected, options);
    }
    throw new Error("grade-failed");
  } catch (error) {
    if (error instanceof Error && error.message === "grade-failed") throw error;
    if (error instanceof OfflineGradeError && error.message === OFFLINE_UNSUPPORTED_MESSAGE) throw error;
    // 網路失敗（含 postGrade 拋出的 OfflineGradeError）→ 嘗試本機離線包
    return gradeWithOfflinePack(question, selected, options);
  }
}

export async function gradeExamRemote(
  items: { questionId: string; selected: string[] }[],
): Promise<{ questionId: string; selected: string[]; correct: boolean; reveal: GradeReveal }[]> {
  try {
    const response = await postGrade({ items });
    if (!response.ok) throw new OfflineGradeError();
    const data = (await response.json()) as {
      results: { questionId: string; correct: boolean; reveal: GradeReveal }[];
    };
    const byId = new Map((data.results ?? []).map((item) => [item.questionId, item]));
    return items.map((item) => {
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
    });
  } catch {
    if (!(await canUseOfflineBank())) throw new OfflineGradeError();
    return items.map((item) => {
      const full = getOfflineFullQuestion(item.questionId);
      if (!full || !canGradeOffline(full)) {
        return {
          questionId: item.questionId,
          selected: item.selected,
          correct: false,
          reveal: { explanation: "", revealText: "", lab: null },
        };
      }
      const graded = gradeOffline(full, item.selected);
      return {
        questionId: item.questionId,
        selected: item.selected,
        correct: graded.correct,
        reveal: graded.reveal,
      };
    });
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
