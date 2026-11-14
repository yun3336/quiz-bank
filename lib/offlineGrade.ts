/**
 * 本機批改：需要完整題（含 answer／aliases／blanks 等）。
 * 網站一般流量仍走 /api/grade；此模組只在離線包可用時由 questionClient 呼叫。
 *
 * 安全註記：完整答案只應存在於原生殼打包的 offline-bank.json，
 * 不可放到 Vercel 的 public/，以免削弱網站端答案保護。
 */
import { gradeQuestion } from "./grade";
import { applyReveal, buildGradeReveal, type GradeReveal } from "./questionPublic";
import type { Question } from "./types";

/** 可在本機完成對錯判定的題型（不依賴伺服器）。 */
export const OFFLINE_GRADEABLE_TYPES: ReadonlySet<Question["type"]> = new Set([
  "single",
  "multiple",
  "boolean",
  "cloze",
  "short",
  "order",
  "match",
  "translate",
  "dictation",
  "hotspot",
  "speak",
]);

/**
 * 瀏覽器語音辨識（Web Speech）在離線時可能不可用；口說題仍可手動輸入後本機批改。
 * UI 應提示：離線時請改打字，勿假設麥克風辨識一定可用。
 */
export function speechRecognitionMayNeedNetwork(): boolean {
  return true;
}

export function canGradeOffline(question: Question): boolean {
  if (!OFFLINE_GRADEABLE_TYPES.has(question.type)) return false;
  return questionHasGradingSecrets(question);
}

export function questionHasGradingSecrets(question: Question): boolean {
  if (question.answer && question.answer.length > 0) return true;
  if (question.aliases && question.aliases.length > 0) return true;
  if (question.type === "cloze" && (question.blanks ?? []).some((blank) => blank.length > 0)) return true;
  if (question.type === "order" && question.tokens && question.tokens.length > 0) return true;
  if (question.type === "match" && question.pairs && question.pairs.length > 0) return true;
  if (question.type === "hotspot" && question.hotspots && question.hotspots.length > 0) {
    // hotspot 正解在 answer（選中的 hotspot id）
    return Boolean(question.answer && question.answer.length > 0);
  }
  return false;
}

export function gradeOffline(
  fullQuestion: Question,
  selected: string[],
  options?: { peek?: boolean; strict?: boolean },
): { correct: boolean; question: Question; reveal: GradeReveal } {
  if (!canGradeOffline(fullQuestion)) {
    throw new Error("offline-grade-unsupported");
  }
  const strict =
    options?.strict || fullQuestion.type === "translate" || fullQuestion.type === "dictation";
  const correct = options?.peek ? false : gradeQuestion(fullQuestion, selected ?? [], { strict });
  const reveal = buildGradeReveal(fullQuestion);
  return {
    correct,
    reveal,
    question: applyReveal(fullQuestion, reveal),
  };
}
