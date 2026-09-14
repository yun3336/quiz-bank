import { defaultDrillMode, type LanguagePracticeMode } from "./languagePractice";
import { ALL_CHAPTER, type DifficultyFilter } from "./questions";
import { tryParseVendor, type Vendor } from "./vendor";

const METHODS: LanguagePracticeMode[] = [
  "mixed",
  "choice",
  "cloze",
  "flash",
  "match",
  "listen",
  "speed",
  "translate",
  "dictation",
  "reading",
  "hotspot",
  "speak",
  "audio",
];

export type PracticePlan = "today";

export type PracticeStart = {
  vendor: Vendor;
  go: boolean;
  resume: boolean;
  qid: string | null;
  plan: PracticePlan | null;
  chapter: string;
  count: number | "all";
  random: boolean;
  method: LanguagePracticeMode;
  difficulty: DifficultyFilter;
};

export type ExamStart = {
  vendor: Vendor;
  go: boolean;
  resume: boolean;
  chapter: string;
  count: number;
  minutes: number;
  difficulty: DifficultyFilter;
};

type Query = Record<string, string | undefined>;

export function firstParam(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value[0] != null) return String(value[0]);
  return undefined;
}

export function readSearchParams(raw: unknown): Query {
  if (!raw || typeof raw !== "object") return {};
  const asSearch = raw as { get?: (key: string) => string | null; forEach?: (cb: (value: string, key: string) => void) => void };
  if (typeof asSearch.forEach === "function") {
    const out: Query = {};
    asSearch.forEach((value, key) => {
      out[key] = value;
    });
    if (Object.keys(out).length > 0) return out;
  }
  const out: Query = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = firstParam(value);
  }
  return out;
}

export function isFlagOn(value: unknown): boolean {
  const s = firstParam(value)?.trim().toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

function parseMethod(value: string | undefined, vendor: Vendor): LanguagePracticeMode {
  return METHODS.includes(value as LanguagePracticeMode)
    ? (value as LanguagePracticeMode)
    : defaultDrillMode(vendor);
}

function parseDifficulty(value: string | undefined): DifficultyFilter {
  if (value === "1" || value === "2" || value === "3") return Number(value) as 1 | 2 | 3;
  return "all";
}

function parseCount(value: string | undefined, fallback: number | "all"): number | "all" {
  if (value === "all") return "all";
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parsePracticeStart(params: Query, fallbackVendor: Vendor | null): PracticeStart | null {
  const vendor = tryParseVendor(params.vendor) ?? fallbackVendor;
  if (!vendor) return null;
  const chapter = params.chapter?.trim() || ALL_CHAPTER;
  const count = parseCount(params.count, 10);
  const random = params.random !== "0";
  const method = parseMethod(params.method, vendor);
  const difficulty = parseDifficulty(params.difficulty);
  const qid = params.qid?.trim() || null;
  const resume = !qid && isFlagOn(params.resume);
  const plan = resume || qid ? null : params.plan === "today" ? "today" : null;
  const go = Boolean(qid) || (!resume && (isFlagOn(params.go) || isFlagOn(params.play) || plan === "today"));
  return {
    vendor,
    go,
    resume,
    qid,
    plan,
    chapter,
    count,
    random,
    method,
    difficulty,
  };
}

export function practiceQuestionHref(vendor: Vendor, questionId: string): string {
  return `/practice?${new URLSearchParams({ vendor, go: "1", qid: questionId }).toString()}`;
}

export function practiceResumeHref(vendor: Vendor): string {
  return `/practice?${new URLSearchParams({ vendor, resume: "1" }).toString()}`;
}

export function practiceChapterHref(vendor: Vendor, chapter: string, count = 10): string {
  return practiceStartHref({
    vendor,
    chapter,
    count,
    random: true,
    method: defaultDrillMode(vendor),
    difficulty: "all",
  });
}

export function practiceTodayHref(vendor: Vendor, count: number): string {
  const params = new URLSearchParams({
    vendor,
    go: "1",
    plan: "today",
    count: String(count),
  });
  return `/practice?${params.toString()}`;
}

export function practiceStartHref(start: {
  vendor: Vendor;
  chapter: string;
  count: number | "all";
  random: boolean;
  method: LanguagePracticeMode;
  difficulty: DifficultyFilter;
}): string {
  const params = new URLSearchParams({
    vendor: start.vendor,
    go: "1",
    chapter: start.chapter,
    count: String(start.count),
    random: start.random ? "1" : "0",
    method: start.method,
    difficulty: String(start.difficulty),
  });
  return `/practice?${params.toString()}`;
}

export function examStartHref(start: {
  vendor: Vendor;
  chapter: string;
  count: number;
  minutes: number;
  difficulty: DifficultyFilter;
}): string {
  const params = new URLSearchParams({
    vendor: start.vendor,
    play: "1",
    chapter: start.chapter,
    count: String(start.count),
    minutes: String(start.minutes),
    difficulty: String(start.difficulty),
  });
  return `/exam?${params.toString()}`;
}

export function parseExamStart(params: Query, fallbackVendor: Vendor | null): ExamStart | null {
  const vendor = tryParseVendor(params.vendor) ?? fallbackVendor;
  if (!vendor) return null;
  const chapter = params.chapter?.trim() || ALL_CHAPTER;
  const countRaw = parseCount(params.count, 20);
  const count = countRaw === "all" ? 20 : countRaw;
  const minutesRaw = Number(params.minutes);
  const minutes = [10, 20, 30, 45].includes(minutesRaw) ? minutesRaw : 20;
  const difficulty = parseDifficulty(params.difficulty);
  const resume = isFlagOn(params.resume);
  const go = !resume && (isFlagOn(params.go) || isFlagOn(params.play));
  return {
    vendor,
    go,
    resume,
    chapter,
    count,
    minutes,
    difficulty,
  };
}

export function examResumeHref(vendor: Vendor): string {
  return `/exam?${new URLSearchParams({ vendor, resume: "1" }).toString()}`;
}
