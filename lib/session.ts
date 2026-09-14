import type { Question } from "./types";

export const SESSION_VENDORS = ["cisco", "huawei", "language", "math", "science", "career"] as const;
export type SessionVendor = (typeof SESSION_VENDORS)[number];

const METHODS = [
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
] as const;

export type SessionMethod = (typeof METHODS)[number];
export type SessionDifficulty = 1 | 2 | 3 | "all";

export type PracticeSession = {
  version: 1;
  kind: "practice";
  vendor: SessionVendor;
  plan: "today" | null;
  chapter: string;
  method: SessionMethod;
  difficulty: SessionDifficulty;
  questionIds: string[];
  index: number;
  submitted: boolean;
  selected: string[];
  revealed: boolean;
  correctCount: number;
  updatedAt: number;
};

export type ExamSession = {
  version: 1;
  kind: "exam";
  vendor: SessionVendor;
  chapter: string;
  difficulty: SessionDifficulty;
  questionIds: string[];
  index: number;
  answers: Record<string, string[]>;
  flaggedIds: string[];
  startedAt: number;
  endsAt: number;
  minutes: number;
  /** 非 null 表示倒數已暫停，剩餘秒數凍結在這個值。 */
  pausedRemaining: number | null;
  pauseMs: number;
  updatedAt: number;
};

export function parsePracticeSession(raw: unknown): PracticeSession | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<PracticeSession>;
  if (data.version !== 1 || data.kind !== "practice") return null;
  if (!isVendor(data.vendor) || !isMethod(data.method) || !isDifficulty(data.difficulty)) return null;
  if (typeof data.chapter !== "string") return null;
  const questionIds = asIdList(data.questionIds);
  if (questionIds.length === 0) return null;
  const index = asIndex(data.index, questionIds.length);
  if (typeof data.submitted !== "boolean" || typeof data.revealed !== "boolean") return null;
  if (typeof data.correctCount !== "number" || data.correctCount < 0) return null;
  const selected = asStringList(data.selected);
  const plan = data.plan === "today" ? "today" : null;
  const updatedAt = asTime(data.updatedAt);
  if (updatedAt == null) return null;
  return {
    version: 1,
    kind: "practice",
    vendor: data.vendor,
    plan,
    chapter: data.chapter,
    method: data.method,
    difficulty: data.difficulty,
    questionIds,
    index,
    submitted: data.submitted,
    selected,
    revealed: data.revealed,
    correctCount: data.correctCount,
    updatedAt,
  };
}

export function parseExamSession(raw: unknown): ExamSession | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<ExamSession> & { answers?: unknown };
  if (data.version !== 1 || data.kind !== "exam") return null;
  if (!isVendor(data.vendor) || !isDifficulty(data.difficulty)) return null;
  if (typeof data.chapter !== "string") return null;
  const questionIds = asIdList(data.questionIds);
  if (questionIds.length === 0) return null;
  const index = asIndex(data.index, questionIds.length);
  const answers = asAnswerMap(data.answers);
  const startedAt = asTime(data.startedAt);
  const endsAt = asTime(data.endsAt);
  const minutes = typeof data.minutes === "number" && data.minutes > 0 ? data.minutes : null;
  const updatedAt = asTime(data.updatedAt);
  if (startedAt == null || endsAt == null || minutes == null || updatedAt == null) return null;
  const pausedRemaining =
    typeof data.pausedRemaining === "number" && Number.isFinite(data.pausedRemaining) && data.pausedRemaining >= 0
      ? Math.floor(data.pausedRemaining)
      : null;
  const pauseMs =
    typeof data.pauseMs === "number" && Number.isFinite(data.pauseMs) && data.pauseMs >= 0 ? data.pauseMs : 0;
  return {
    version: 1,
    kind: "exam",
    vendor: data.vendor,
    chapter: data.chapter,
    difficulty: data.difficulty,
    questionIds,
    index,
    answers,
    flaggedIds: asIdList(data.flaggedIds),
    startedAt,
    endsAt,
    minutes,
    pausedRemaining,
    pauseMs,
    updatedAt,
  };
}

export function resolveSessionQuestions(ids: string[], map: Map<string, Question>): Question[] {
  return ids.map((id) => map.get(id)).filter((item): item is Question => Boolean(item));
}

export function restoreQuizIndex(ids: string[], questions: Question[], index: number): number {
  if (questions.length === 0) return 0;
  const currentId = ids[index];
  const found = currentId ? questions.findIndex((item) => item.id === currentId) : -1;
  if (found >= 0) return found;
  return Math.min(index, questions.length - 1);
}

export function remainingExamSec(endsAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function examClockRemaining(
  session: Pick<ExamSession, "endsAt" | "pausedRemaining">,
  now = Date.now(),
): number {
  if (session.pausedRemaining != null) return Math.max(0, session.pausedRemaining);
  return remainingExamSec(session.endsAt, now);
}

export function resumeExamEndsAt(pausedRemaining: number, now = Date.now()): number {
  return now + Math.max(0, pausedRemaining) * 1000;
}

export function collectExamReview(
  ids: string[],
  answered: (id: string) => boolean,
  flaggedIds: string[],
): { unanswered: number[]; flagged: number[] } {
  const flagged = new Set(flaggedIds);
  const unanswered: number[] = [];
  const marked: number[] = [];
  ids.forEach((id, index) => {
    if (!answered(id)) unanswered.push(index);
    if (flagged.has(id)) marked.push(index);
  });
  return { unanswered, flagged: marked };
}

export function formatClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isVendor(value: unknown): value is SessionVendor {
  return SESSION_VENDORS.includes(value as SessionVendor);
}

function isMethod(value: unknown): value is SessionMethod {
  return METHODS.includes(value as SessionMethod);
}

function isDifficulty(value: unknown): value is SessionDifficulty {
  return value === "all" || value === 1 || value === 2 || value === 3;
}

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asIndex(value: unknown, length: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
  if (n < 0) return 0;
  if (n >= length) return length - 1;
  return n;
}

function asTime(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function asAnswerMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = asStringList(item);
  }
  return out;
}
