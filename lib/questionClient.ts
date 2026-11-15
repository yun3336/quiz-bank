import { applyReveal, type GradeReveal } from "./questionPublic";
import type { Attempt, ProgressStore, Question } from "./types";
import type { LanguagePracticeMode } from "./languagePractice";
import type { DifficultyFilter } from "./questions";
import type { Vendor } from "./vendor";

const CATALOG_KEY = "quiz-bank:catalog-v1";

export const OFFLINE_GRADE_MESSAGE = "需連線批改";

export class OfflineGradeError extends Error {
  constructor() {
    super(OFFLINE_GRADE_MESSAGE);
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

export function cachedCatalog(vendor?: Vendor): Question[] {
  const cache = readCache();
  if (vendor) return cache.byVendor[vendor] ?? cache.all.filter((item) => item.chapter);
  return cache.all;
}

/** 清除記憶體中的題目目錄快取（本機資料全清時一併呼叫）。 */
export function resetCatalogCache(): void {
  memory = { all: [], byVendor: {} };
}

export async function loadCatalog(vendor?: Vendor): Promise<Question[]> {
  const query = vendor ? `?vendor=${encodeURIComponent(vendor)}` : "";
  const response = await fetch(`/api/catalog${query}`);
  if (!response.ok) throw new Error("catalog-failed");
  const data = (await response.json()) as { questions?: Question[]; vendors?: { vendor: Vendor; count: number }[] };
  const questions = Array.isArray(data.questions) ? data.questions : [];
  readCache();
  if (vendor) {
    memory.byVendor[vendor] = questions;
    const others = memory.all.filter((item) => !questions.some((next) => next.id === item.id));
    memory.all = [...others, ...questions];
  } else if (questions.length > 0) {
    memory.all = questions;
  }
  writeCache();
  return vendor ? memory.byVendor[vendor] ?? [] : memory.all;
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
  const response = await fetch("/api/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("quiz-failed");
  const data = (await response.json()) as { questions?: Question[] };
  return Array.isArray(data.questions) ? data.questions : [];
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

export async function gradeRemote(
  question: Question,
  selected: string[],
  options?: { peek?: boolean; strict?: boolean },
): Promise<{ correct: boolean; question: Question; reveal: GradeReveal }> {
  const response = await postGrade({
    questionId: question.id,
    selected,
    peek: options?.peek,
    mode: options?.strict ? "strict" : "loose",
  });
  if (!response.ok) {
    if (response.status === 0 || response.status >= 500) throw new OfflineGradeError();
    throw new Error("grade-failed");
  }
  const data = (await response.json()) as { correct: boolean; reveal: GradeReveal };
  return {
    correct: data.correct,
    reveal: data.reveal,
    question: applyReveal(question, data.reveal),
  };
}

export async function gradeExamRemote(
  items: { questionId: string; selected: string[] }[],
): Promise<{ questionId: string; selected: string[]; correct: boolean; reveal: GradeReveal }[]> {
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
