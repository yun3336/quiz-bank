import {
  emptyPendingQueue,
  enqueueExamBatch,
  enqueueGrade,
  openPendingExams,
  openPendingGrades,
  parsePendingQueue,
  PENDING_GRADE_KEY,
  pendingCounts,
  removeSettled,
  markExamSettled,
  markGradeSettled,
  type PendingExamBatch,
  type PendingGradeItem,
  type PendingQueue,
} from "./pendingGrade";

const PENDING_EVENT = "quiz-bank:pending";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function notifyPending(): void {
  if (!canUseStorage()) return;
  window.dispatchEvent(new Event(PENDING_EVENT));
}

export function subscribePending(onChange: () => void): () => void {
  if (!canUseStorage()) return () => undefined;
  window.addEventListener(PENDING_EVENT, onChange);
  return () => window.removeEventListener(PENDING_EVENT, onChange);
}

export function loadPendingQueue(): PendingQueue {
  if (!canUseStorage()) return emptyPendingQueue();
  try {
    const raw = localStorage.getItem(PENDING_GRADE_KEY);
    if (!raw) return emptyPendingQueue();
    return parsePendingQueue(JSON.parse(raw));
  } catch {
    return emptyPendingQueue();
  }
}

export function savePendingQueue(queue: PendingQueue): void {
  if (!canUseStorage()) return;
  const cleaned = removeSettled(queue, 0);
  localStorage.setItem(PENDING_GRADE_KEY, JSON.stringify(cleaned));
  notifyPending();
}

export function queuePendingGrade(
  item: Omit<PendingGradeItem, "id"> & { id?: string },
): PendingGradeItem {
  const queue = loadPendingQueue();
  const before = queue.grades.length;
  const next = enqueueGrade(queue, item);
  savePendingQueue(next);
  const added = next.grades[next.grades.length - 1];
  if (next.grades.length === before) {
    const existing = openPendingGrades(next).find(
      (entry) =>
        entry.questionId === item.questionId &&
        entry.mode === item.mode &&
        JSON.stringify(entry.selected) === JSON.stringify(item.selected),
    );
    return existing ?? added;
  }
  return added;
}

export function queuePendingExam(
  batch: Omit<PendingExamBatch, "id" | "kind"> & { id?: string },
): PendingExamBatch {
  const next = enqueueExamBatch(loadPendingQueue(), batch);
  savePendingQueue(next);
  return next.exams[next.exams.length - 1];
}

export function settlePendingGrade(id: string): void {
  savePendingQueue(markGradeSettled(loadPendingQueue(), id));
}

export function settlePendingExam(id: string): void {
  savePendingQueue(markExamSettled(loadPendingQueue(), id));
}

export function getPendingSummary() {
  return pendingCounts(loadPendingQueue());
}

export function listOpenPendingGrades(): PendingGradeItem[] {
  return openPendingGrades(loadPendingQueue());
}

export function listOpenPendingExams(): PendingExamBatch[] {
  return openPendingExams(loadPendingQueue());
}
