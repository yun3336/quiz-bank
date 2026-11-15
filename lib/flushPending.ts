/**
 * 上線後沖洗待批改佇列：伺服端批改成功才寫入 attempts，同一 pending id 只記一次。
 */
import { applyReveal, type GradeReveal } from "./questionPublic";
import { apiUrl } from "./apiBase";
import {
  listOpenPendingExams,
  listOpenPendingGrades,
  settlePendingExam,
  settlePendingGrade,
} from "./pendingGradeStore";
import { recordAttempts, recordExam, saveExamResult } from "./storage";
import type { Attempt, ExamResultItem, Question } from "./types";

async function postGrade(body: unknown): Promise<Response> {
  return fetch(apiUrl("/api/grade"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type FlushReport = {
  graded: number;
  exams: number;
  failed: number;
};

let flushInFlight: Promise<FlushReport> | null = null;
const settlingIds = new Set<string>();

export async function flushPendingGrades(): Promise<FlushReport> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = runFlush().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

async function runFlush(): Promise<FlushReport> {
  const report: FlushReport = { graded: 0, exams: 0, failed: 0 };
  if (typeof window === "undefined") return report;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return report;

  for (const item of listOpenPendingGrades()) {
    if (settlingIds.has(item.id)) continue;
    settlingIds.add(item.id);
    try {
      const response = await postGrade({
        questionId: item.questionId,
        selected: item.selected,
        peek: item.peek,
        mode: item.strict ? "strict" : "loose",
        clientRequestId: item.id,
      });
      if (!response.ok) {
        report.failed += 1;
        settlingIds.delete(item.id);
        continue;
      }
      const data = (await response.json()) as { correct: boolean; reveal: GradeReveal };
      if (!item.peek) {
        const attempt: Attempt = {
          questionId: item.questionId,
          selected: item.selected,
          correct: data.correct,
          at: item.at,
          mode: item.mode,
        };
        recordAttempts([attempt]);
      }
      settlePendingGrade(item.id);
      report.graded += 1;
    } catch {
      report.failed += 1;
      settlingIds.delete(item.id);
    }
  }

  for (const batch of listOpenPendingExams()) {
    if (settlingIds.has(batch.id)) continue;
    settlingIds.add(batch.id);
    try {
      const response = await postGrade({
        items: batch.items,
        clientRequestId: batch.id,
      });
      if (!response.ok) {
        report.failed += 1;
        settlingIds.delete(batch.id);
        continue;
      }
      const data = (await response.json()) as {
        results: { questionId: string; correct: boolean; reveal: GradeReveal }[];
      };
      const byId = new Map((data.results ?? []).map((row) => [row.questionId, row]));
      const items: ExamResultItem[] = batch.items.map((row) => {
        const hit = byId.get(row.questionId);
        return {
          questionId: row.questionId,
          selected: row.selected,
          correct: hit?.correct ?? false,
        };
      });
      const score = items.filter((row) => row.correct).length;
      const now = Date.now();
      const record = {
        id: `exam-${batch.id}`,
        startedAt: batch.startedAt,
        durationSec: batch.durationSec,
        score,
        total: batch.total,
        chapter: batch.chapter,
      };
      const attempts: Attempt[] = items.map((row) => ({
        questionId: row.questionId,
        selected: row.selected,
        correct: row.correct,
        at: batch.at || now,
        mode: "exam" as const,
      }));
      recordExam(record, attempts);
      saveExamResult({ record, items });
      settlePendingExam(batch.id);
      report.exams += 1;
    } catch {
      report.failed += 1;
      settlingIds.delete(batch.id);
    }
  }

  return report;
}

export function applyServerReveal(question: Question, reveal: GradeReveal): Question {
  return applyReveal(question, reveal);
}
