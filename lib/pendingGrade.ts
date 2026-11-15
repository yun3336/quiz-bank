/**
 * 離線待批改佇列：只存題號與作答，不含正解。
 * 上線後由伺服端批改；成功前不得寫入 attempts 統計。
 */

export type PendingGradeItem = {
  /** 客戶端冪等鍵；成功處理後移除，避免重複記分 */
  id: string;
  questionId: string;
  selected: string[];
  mode: "practice" | "exam";
  peek?: boolean;
  strict?: boolean;
  at: number;
  /** 已成功批改並寫入 attempts 後標記，防重入 */
  settledAt?: number;
};

export type PendingExamBatch = {
  id: string;
  kind: "exam-batch";
  items: { questionId: string; selected: string[] }[];
  startedAt: number;
  durationSec: number;
  chapter: string;
  total: number;
  at: number;
  settledAt?: number;
};

export type PendingQueue = {
  version: 1;
  grades: PendingGradeItem[];
  exams: PendingExamBatch[];
};

export const PENDING_GRADE_KEY = "quiz-bank:pending-grades";
export const MAX_PENDING_GRADES = 200;
export const MAX_PENDING_EXAMS = 20;

export function emptyPendingQueue(): PendingQueue {
  return { version: 1, grades: [], exams: [] };
}

export function parsePendingQueue(raw: unknown): PendingQueue {
  if (!raw || typeof raw !== "object") return emptyPendingQueue();
  const data = raw as Partial<PendingQueue>;
  const grades = Array.isArray(data.grades)
    ? data.grades.filter((item): item is PendingGradeItem => Boolean(item && typeof item.id === "string" && typeof item.questionId === "string"))
    : [];
  const exams = Array.isArray(data.exams)
    ? data.exams.filter((item): item is PendingExamBatch => Boolean(item && item.kind === "exam-batch" && typeof item.id === "string"))
    : [];
  return { version: 1, grades, exams };
}

export function createPendingId(now = Date.now()): string {
  return `pg-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

export function enqueueGrade(queue: PendingQueue, item: Omit<PendingGradeItem, "id"> & { id?: string }): PendingQueue {
  const next: PendingGradeItem = {
    ...item,
    id: item.id ?? createPendingId(item.at),
  };
  // 同一題＋同一作答＋未 settle 不重複排隊
  const duplicate = queue.grades.find(
    (existing) =>
      !existing.settledAt &&
      existing.questionId === next.questionId &&
      existing.mode === next.mode &&
      JSON.stringify(existing.selected) === JSON.stringify(next.selected),
  );
  if (duplicate) return queue;
  const grades = [...queue.grades, next].slice(-MAX_PENDING_GRADES);
  return { ...queue, grades };
}

export function enqueueExamBatch(
  queue: PendingQueue,
  batch: Omit<PendingExamBatch, "id" | "kind"> & { id?: string },
): PendingQueue {
  const next: PendingExamBatch = {
    ...batch,
    kind: "exam-batch",
    id: batch.id ?? createPendingId(batch.at),
  };
  const duplicate = queue.exams.find(
    (existing) =>
      !existing.settledAt &&
      existing.startedAt === next.startedAt &&
      existing.chapter === next.chapter &&
      existing.total === next.total &&
      JSON.stringify(existing.items) === JSON.stringify(next.items),
  );
  if (duplicate) return queue;
  const exams = [...queue.exams, next].slice(-MAX_PENDING_EXAMS);
  return { ...queue, exams };
}

export function markGradeSettled(queue: PendingQueue, id: string, settledAt = Date.now()): PendingQueue {
  return {
    ...queue,
    grades: queue.grades.map((item) => (item.id === id ? { ...item, settledAt } : item)),
  };
}

export function markExamSettled(queue: PendingQueue, id: string, settledAt = Date.now()): PendingQueue {
  return {
    ...queue,
    exams: queue.exams.map((item) => (item.id === id ? { ...item, settledAt } : item)),
  };
}

export function removeSettled(queue: PendingQueue, olderThanMs = 0, now = Date.now()): PendingQueue {
  return {
    version: 1,
    grades: queue.grades.filter((item) => !item.settledAt || now - item.settledAt < olderThanMs),
    exams: queue.exams.filter((item) => !item.settledAt || now - item.settledAt < olderThanMs),
  };
}

export function openPendingGrades(queue: PendingQueue): PendingGradeItem[] {
  return queue.grades.filter((item) => !item.settledAt);
}

export function openPendingExams(queue: PendingQueue): PendingExamBatch[] {
  return queue.exams.filter((item) => !item.settledAt);
}

export function pendingCounts(queue: PendingQueue): { grades: number; exams: number; total: number } {
  const grades = openPendingGrades(queue).length;
  const exams = openPendingExams(queue).length;
  return { grades, exams, total: grades + exams };
}
