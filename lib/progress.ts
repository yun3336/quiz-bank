import type { Attempt, ExamRecord, LabCompletion, ProgressStore } from "./types";
import { WRONG_CLEAR_STREAK } from "./wrongBook";

export function compactStore(store: ProgressStore): ProgressStore {
  return {
    attempts: compactAttempts(store.attempts),
    examHistory: compactExamHistory(store.examHistory),
    labCompletions: store.labCompletions,
    starredIds: [...new Set(store.starredIds.filter((id) => typeof id === "string"))],
    notes: normalizeNotes(store.notes),
  };
}

export function mergeProgressStores(base: ProgressStore, incoming: ProgressStore): ProgressStore {
  return compactStore({
    attempts: mergeAttempts(base.attempts, incoming.attempts),
    examHistory: mergeExams(base.examHistory, incoming.examHistory),
    labCompletions: mergeLabs(base.labCompletions, incoming.labCompletions),
    starredIds: [...new Set([...base.starredIds, ...incoming.starredIds])],
    notes: mergeNotes(base.notes ?? {}, incoming.notes ?? {}),
  });
}
export const MAX_ATTEMPTS = 3000;
export const MAX_EXAM_HISTORY = 80;

function attemptKey(attempt: Attempt): string {
  return [
    attempt.questionId,
    String(attempt.at),
    attempt.mode,
    attempt.correct ? "1" : "0",
    ...(attempt.selected ?? []),
  ].join("\0");
}

export function mergeAttempts(left: Attempt[], right: Attempt[]): Attempt[] {
  const seen = new Set<string>();
  const merged: Attempt[] = [];
  for (const item of [...left, ...right].sort((a, b) => a.at - b.at)) {
    const key = attemptKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

export function compactAttempts(attempts: Attempt[], max = MAX_ATTEMPTS): Attempt[] {
  if (attempts.length <= max) return attempts;

  const keep = new Uint8Array(attempts.length);
  for (let index = attempts.length - max; index < attempts.length; index += 1) {
    keep[index] = 1;
  }

  const lastWrong = new Map<string, number>();
  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    if (!attempt.correct) lastWrong.set(attempt.questionId, index);
  }

  for (const [questionId, wrongIndex] of lastWrong) {
    let streak = 0;
    for (let index = attempts.length - 1; index >= 0; index -= 1) {
      const attempt = attempts[index];
      if (attempt.questionId !== questionId) continue;
      if (!attempt.correct) break;
      streak += 1;
    }
    if (streak >= WRONG_CLEAR_STREAK) continue;
    keep[wrongIndex] = 1;
    for (let index = wrongIndex + 1; index < attempts.length; index += 1) {
      if (attempts[index].questionId === questionId) keep[index] = 1;
    }
  }

  return attempts.filter((_, index) => keep[index] === 1);
}

export function compactExamHistory(exams: ExamRecord[], max = MAX_EXAM_HISTORY): ExamRecord[] {
  if (exams.length <= max) return exams;
  return [...exams].sort((a, b) => b.startedAt - a.startedAt).slice(0, max);
}

function mergeExams(left: ExamRecord[], right: ExamRecord[]): ExamRecord[] {
  const map = new Map<string, ExamRecord>();
  for (const item of [...left, ...right]) {
    if (!item?.id || map.has(item.id)) continue;
    map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => a.startedAt - b.startedAt);
}

function mergeLabs(left: LabCompletion[], right: LabCompletion[]): LabCompletion[] {
  const map = new Map<string, LabCompletion>();
  for (const item of [...left, ...right]) {
    if (!item?.labId) continue;
    const previous = map.get(item.labId);
    if (!previous || item.at < previous.at) map.set(item.labId, item);
  }
  return [...map.values()];
}

export const MAX_NOTE_LENGTH = 2000;

export function normalizeNote(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  return text.length > MAX_NOTE_LENGTH ? text.slice(0, MAX_NOTE_LENGTH) : text;
}

export function normalizeNotes(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [id, text] of Object.entries(value)) {
    if (typeof id !== "string" || !id) continue;
    const cleaned = normalizeNote(text);
    if (cleaned) out[id] = cleaned;
  }
  return out;
}

export function mergeNotes(
  base: Record<string, string>,
  incoming: Record<string, string>,
): Record<string, string> {
  const out = { ...normalizeNotes(base) };
  for (const [id, text] of Object.entries(normalizeNotes(incoming))) {
    const current = out[id];
    if (!current || text.length >= current.length) out[id] = text;
  }
  return out;
}
