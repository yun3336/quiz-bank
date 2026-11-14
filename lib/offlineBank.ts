/**
 * 原生殼離線題庫載入與抽題。
 *
 * 完整題（含正解）只從 /offline-bank.json 讀取——該檔由 Capacitor www 建置腳本放入，
 * 不會進入網站 public/（見 scripts/build-offline-bank.mjs、docs/ios-capacitor.md）。
 */
import { pickTodayQuiz } from "./todayPlan";
import { toPublicQuestion } from "./questionPublic";
import {
  expandPassageInPool,
  filterPool,
  pickLanguageQuizFromPool,
  pickQuestionsFromPool,
  resolveQuestionInPool,
} from "./quizPick.shared";
import { defaultDrillMode } from "./languagePractice";
import type { LanguagePracticeMode } from "./practiceModes";
import { ALL_CHAPTER, type DifficultyFilter } from "./questions";
import type { ProgressStore, Question } from "./types";
import { questionVendor, type Vendor } from "./vendor";
import { OFFLINE_BANK_URL, isNativeShell } from "./nativeShell";

type OfflineBankFile = {
  version: number;
  generatedAt: string;
  questions: Question[];
};

let fullPool: Question[] | null = null;
let fullById = new Map<string, Question>();
let bankProbe: Promise<boolean> | null = null;
let bankAvailable: boolean | null = null;

function indexPool(pool: Question[]) {
  fullPool = pool;
  fullById = new Map(pool.map((item) => [item.id, item]));
}

export function resetOfflineBankCache(): void {
  fullPool = null;
  fullById = new Map();
  bankProbe = null;
  bankAvailable = null;
}

export function getOfflineFullQuestion(id: string): Question | undefined {
  if (!fullPool) return undefined;
  return resolveQuestionInPool(id, fullPool) ?? fullById.get(id);
}

/** 探測離線包是否存在（原生殼或本機 www）。網站 production 應為 false。 */
export async function probeOfflineBank(): Promise<boolean> {
  if (bankAvailable !== null) return bankAvailable;
  if (bankProbe) return bankProbe;
  bankProbe = (async () => {
    try {
      const response = await fetch(OFFLINE_BANK_URL, { method: "GET", cache: "no-store" });
      if (!response.ok) {
        bankAvailable = false;
        return false;
      }
      const data = (await response.json()) as OfflineBankFile;
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        bankAvailable = false;
        return false;
      }
      indexPool(data.questions);
      bankAvailable = true;
      return true;
    } catch {
      bankAvailable = false;
      return false;
    }
  })();
  return bankProbe;
}

export async function ensureOfflineBank(): Promise<Question[]> {
  const ok = await probeOfflineBank();
  if (!ok || !fullPool) throw new Error("offline-bank-missing");
  return fullPool;
}

export function offlineBankReady(): boolean {
  return Boolean(fullPool && fullPool.length > 0);
}

/** 是否允許走離線抽題／批改：已載入離線包，或明確為原生殼並可探測到檔案。 */
export async function canUseOfflineBank(): Promise<boolean> {
  if (offlineBankReady()) return true;
  if (isNativeShell()) return probeOfflineBank();
  // 非原生：仍探測一次，方便本機 `www` 靜態預覽；Vercel 上檔案不存在即 false
  return probeOfflineBank();
}

export async function loadOfflineCatalog(vendor?: Vendor): Promise<Question[]> {
  const pool = await ensureOfflineBank();
  const filtered = vendor ? filterPool(pool, { vendor }) : pool;
  return filtered.map(toPublicQuestion);
}

export async function loadOfflineQuiz(body: {
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
  const pool = await ensureOfflineBank();
  const chapter = body.chapter?.trim() || ALL_CHAPTER;
  const count = body.count ?? 10;
  const random = body.random !== false;
  const difficulty = body.difficulty ?? "all";

  if (body.kind === "ids" || (body.ids && body.ids.length > 0)) {
    const picked = (body.ids ?? []).flatMap((id) => {
      const question = resolveQuestionInPool(id, pool);
      return question ? expandPassageInPool(question, pool) : [];
    });
    return picked.map(toPublicQuestion);
  }

  if (body.qid) {
    const question = resolveQuestionInPool(body.qid, pool);
    if (!question) return [];
    return expandPassageInPool(question, pool).map(toPublicQuestion);
  }

  if (body.kind === "today") {
    const store: ProgressStore = body.store ?? {
      attempts: [],
      examHistory: [],
      labCompletions: [],
      starredIds: [],
      notes: {},
    };
    const size = typeof count === "number" ? count : 10;
    const vendorPool = filterPool(pool, { vendor: body.vendor });
    const picked = pickTodayQuiz({
      store,
      pool: vendorPool,
      count: size,
      random,
    });
    return picked.questions.map(toPublicQuestion);
  }

  if (body.kind === "exam") {
    const examCount = typeof count === "number" ? count : 20;
    const picked = pickQuestionsFromPool(pool, {
      vendor: body.vendor,
      chapter,
      count: examCount,
      random: true,
      difficulty,
    });
    return picked.map(toPublicQuestion);
  }

  const method = body.method ?? defaultDrillMode(body.vendor);
  const picked = pickLanguageQuizFromPool(pool, {
    vendor: body.vendor,
    chapter,
    count,
    random,
    method,
    difficulty,
  });
  return picked.map(toPublicQuestion);
}

export function offlineCatalogMeta(pool: Question[] = fullPool ?? []) {
  const vendors: Vendor[] = ["cisco", "huawei", "language", "math", "science", "career"];
  return vendors.map((vendor) => {
    const items = pool.filter((item) => questionVendor(item) === vendor);
    return {
      vendor,
      count: items.length,
      chapters: [...new Set(items.map((item) => item.chapter))],
    };
  });
}
