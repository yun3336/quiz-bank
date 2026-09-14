import { parseRemindPref, type RemindPref } from "./remind";
import { parseExamSession, parsePracticeSession, type ExamSession, type PracticeSession } from "./session";
import { compactStore, MAX_ATTEMPTS, MAX_EXAM_HISTORY, mergeProgressStores, normalizeNote, normalizeNotes } from "./progress";
import { DEFAULT_DAILY_GOAL, parseDailyGoal, type DailyGoal } from "./todayPlan";
import type { Attempt, ExamRecord, ExamResultSnapshot, ProgressStore } from "./types";
import { tryParseVendor, type Vendor } from "./vendor";

const STORE_KEY = "quiz-bank:v1";
const EXAM_RESULT_KEY = "quiz-bank:exam-result";
const VENDOR_KEY = "quiz-bank:vendor";
export const VENDOR_COOKIE = "quiz-bank-vendor";
const THEME_KEY = "quiz-bank:theme";
const DAILY_GOAL_KEY = "quiz-bank:daily-goal";
const PRACTICE_SESSION_KEY = "quiz-bank:session-practice";
const EXAM_SESSION_KEY = "quiz-bank:session-exam";
const INSTALL_HIDE_KEY = "quiz-bank:install-hide";
const REMIND_KEY = "quiz-bank:remind";
const REMIND_LAST_KEY = "quiz-bank:remind-last";
const PROGRESS_EVENT = "quiz-bank:progress";
const SESSION_EVENT = "quiz-bank:session";
const REMIND_EVENT = "quiz-bank:remind";

const emptyStore = (): ProgressStore => ({
  attempts: [],
  examHistory: [],
  labCompletions: [],
  starredIds: [],
  notes: {},
});

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function notifyProgress(): void {
  if (!canUseStorage()) return;
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

export function subscribeProgress(onChange: () => void): () => void {
  if (!canUseStorage()) return () => undefined;
  window.addEventListener(PROGRESS_EVENT, onChange);
  return () => window.removeEventListener(PROGRESS_EVENT, onChange);
}

export function loadProgress(): ProgressStore {
  if (!canUseStorage()) return emptyStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as ProgressStore;
    const store: ProgressStore = {
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      examHistory: Array.isArray(parsed.examHistory) ? parsed.examHistory : [],
      labCompletions: Array.isArray(parsed.labCompletions) ? parsed.labCompletions : [],
      starredIds: Array.isArray(parsed.starredIds)
        ? parsed.starredIds.filter((item) => typeof item === "string")
        : [],
      notes: normalizeNotes(parsed.notes),
    };
    if (store.attempts.length > MAX_ATTEMPTS || store.examHistory.length > MAX_EXAM_HISTORY) {
      const compacted = compactStore(store);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(compacted));
      } catch {
        return compacted;
      }
      return compacted;
    }
    return store;
  } catch {
    return emptyStore();
  }
}

export function saveProgress(store: ProgressStore): void {
  if (!canUseStorage()) return;
  localStorage.setItem(STORE_KEY, JSON.stringify(compactStore(store)));
  notifyProgress();
}

export function recordAttempts(attempts: Attempt[]): ProgressStore {
  const store = loadProgress();
  store.attempts.push(...attempts);
  saveProgress(store);
  return store;
}

export function recordExam(record: ExamRecord, attempts: Attempt[]): ProgressStore {
  const store = loadProgress();
  store.attempts.push(...attempts);
  store.examHistory.push(record);
  saveProgress(store);
  return store;
}

export function saveExamResult(snapshot: ExamResultSnapshot): void {
  if (!canUseStorage()) return;
  sessionStorage.setItem(EXAM_RESULT_KEY, JSON.stringify(snapshot));
}

export function loadExamResult(): ExamResultSnapshot | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(EXAM_RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExamResultSnapshot;
  } catch {
    return null;
  }
}

export function clearExamResult(): void {
  if (!canUseStorage()) return;
  sessionStorage.removeItem(EXAM_RESULT_KEY);
}

export function recordLabCompletion(labId: string): ProgressStore {
  const store = loadProgress();
  if (!store.labCompletions.some((item) => item.labId === labId)) {
    store.labCompletions.push({ labId, at: Date.now() });
    saveProgress(store);
  }
  return store;
}

export function isLabCompleted(labId: string): boolean {
  return loadProgress().labCompletions.some((item) => item.labId === labId);
}

export function isStarred(questionId: string): boolean {
  return loadProgress().starredIds.includes(questionId);
}

export function toggleStar(questionId: string): boolean {
  const store = loadProgress();
  const index = store.starredIds.indexOf(questionId);
  if (index >= 0) store.starredIds.splice(index, 1);
  else store.starredIds.push(questionId);
  saveProgress(store);
  return store.starredIds.includes(questionId);
}

export function getNote(questionId: string): string {
  return loadProgress().notes[questionId] ?? "";
}

export function saveNote(questionId: string, value: string): string {
  const store = loadProgress();
  const cleaned = normalizeNote(value);
  if (cleaned) store.notes[questionId] = cleaned;
  else delete store.notes[questionId];
  saveProgress(store);
  return cleaned;
}

export function exportProgressJson(): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: Date.now(),
      progress: loadProgress(),
    },
    null,
    2,
  );
}

function normalizeImportedProgress(progress: Partial<ProgressStore>): ProgressStore {
  return {
    attempts: Array.isArray(progress.attempts) ? progress.attempts : [],
    examHistory: Array.isArray(progress.examHistory) ? progress.examHistory : [],
    labCompletions: Array.isArray(progress.labCompletions) ? progress.labCompletions : [],
    starredIds: Array.isArray(progress.starredIds)
      ? progress.starredIds.filter((item) => typeof item === "string")
      : [],
    notes: normalizeNotes(progress.notes),
  };
}

export function importProgressJson(
  raw: string,
  mode: "merge" | "replace" = "merge",
): { ok: true } | { ok: false; error: string } {
  try {
    const data = JSON.parse(raw) as { progress?: ProgressStore } & Partial<ProgressStore>;
    const progress = data.progress ?? data;
    if (!progress || !Array.isArray(progress.attempts)) {
      return { ok: false, error: "檔案不是題庫進度格式" };
    }
    const incoming = normalizeImportedProgress(progress);
    saveProgress(mode === "replace" ? incoming : mergeProgressStores(loadProgress(), incoming));
    return { ok: true };
  } catch {
    return { ok: false, error: "無法讀取這個檔案" };
  }
}

const VENDOR_EVENT = "quiz-bank:vendor";

export function loadLastVendor(): Vendor | null {
  if (!canUseStorage()) return null;
  try {
    return tryParseVendor(localStorage.getItem(VENDOR_KEY));
  } catch {
    return null;
  }
}

export function saveLastVendor(vendor: Vendor): void {
  if (!canUseStorage()) return;
  let changed = true;
  try {
    changed = localStorage.getItem(VENDOR_KEY) !== vendor;
    localStorage.setItem(VENDOR_KEY, vendor);
    document.cookie = `${VENDOR_COOKIE}=${vendor}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.dataset.vendor = vendor;
  } catch {
    changed = true;
  }
  if (changed) window.dispatchEvent(new Event(VENDOR_EVENT));
}

export function subscribeLastVendor(onChange: () => void): () => void {
  if (!canUseStorage()) return () => undefined;
  window.addEventListener(VENDOR_EVENT, onChange);
  return () => window.removeEventListener(VENDOR_EVENT, onChange);
}

export type ThemePref = "light" | "dark";

export function loadTheme(): ThemePref | null {
  if (!canUseStorage()) return null;
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

export function saveTheme(theme: ThemePref): void {
  if (!canUseStorage()) return;
  localStorage.setItem(THEME_KEY, theme);
}

export function resolveTheme(): ThemePref {
  const stored = loadTheme();
  if (stored) return stored;
  if (canUseStorage() && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export function applyTheme(theme: ThemePref): void {
  if (!canUseStorage()) return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function loadDailyGoal(): DailyGoal {
  if (!canUseStorage()) return DEFAULT_DAILY_GOAL;
  try {
    return parseDailyGoal(localStorage.getItem(DAILY_GOAL_KEY));
  } catch {
    return DEFAULT_DAILY_GOAL;
  }
}

export function saveDailyGoal(goal: DailyGoal): void {
  if (!canUseStorage()) return;
  localStorage.setItem(DAILY_GOAL_KEY, String(goal));
}

export function loadInstallHidden(): boolean {
  if (!canUseStorage()) return false;
  return localStorage.getItem(INSTALL_HIDE_KEY) === "1";
}

export function hideInstallPrompt(): void {
  if (!canUseStorage()) return;
  localStorage.setItem(INSTALL_HIDE_KEY, "1");
}

export function loadRemindPref(): RemindPref {
  if (!canUseStorage()) return parseRemindPref(null);
  try {
    const raw = localStorage.getItem(REMIND_KEY);
    return parseRemindPref(raw ? JSON.parse(raw) : null);
  } catch {
    return parseRemindPref(null);
  }
}

export function saveRemindPref(pref: RemindPref): void {
  if (!canUseStorage()) return;
  localStorage.setItem(REMIND_KEY, JSON.stringify(pref));
  window.dispatchEvent(new Event(REMIND_EVENT));
}

export function subscribeRemind(onChange: () => void): () => void {
  if (!canUseStorage()) return () => undefined;
  window.addEventListener(REMIND_EVENT, onChange);
  return () => window.removeEventListener(REMIND_EVENT, onChange);
}

export function loadRemindLastDay(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(REMIND_LAST_KEY);
}

export function saveRemindLastDay(day: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(REMIND_LAST_KEY, day);
}

export function subscribeSession(onChange: () => void): () => void {
  if (!canUseStorage()) return () => undefined;
  window.addEventListener(SESSION_EVENT, onChange);
  return () => window.removeEventListener(SESSION_EVENT, onChange);
}

function notifySession(): void {
  if (!canUseStorage()) return;
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function loadPracticeSession(): PracticeSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(PRACTICE_SESSION_KEY);
    if (!raw) return null;
    return parsePracticeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function savePracticeSession(session: PracticeSession): void {
  if (!canUseStorage()) return;
  localStorage.setItem(PRACTICE_SESSION_KEY, JSON.stringify(session));
  notifySession();
}

export function clearPracticeSession(): void {
  if (!canUseStorage()) return;
  if (!localStorage.getItem(PRACTICE_SESSION_KEY)) return;
  localStorage.removeItem(PRACTICE_SESSION_KEY);
  notifySession();
}

export function loadExamSession(): ExamSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(EXAM_SESSION_KEY);
    if (!raw) return null;
    return parseExamSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveExamSession(session: ExamSession): void {
  if (!canUseStorage()) return;
  localStorage.setItem(EXAM_SESSION_KEY, JSON.stringify(session));
  notifySession();
}

export function clearExamSession(): void {
  if (!canUseStorage()) return;
  if (!localStorage.getItem(EXAM_SESSION_KEY)) return;
  localStorage.removeItem(EXAM_SESSION_KEY);
  notifySession();
}
