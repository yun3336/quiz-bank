import "server-only";
import type { Question } from "./types";
import {
  byDifficulty,
  type DifficultyFilter,
} from "./questions";
import { filterQuestions, getQuestionMap, pickQuestions } from "./questions.server";
import type { LanguagePracticeMode } from "./practiceModes";
import type { Vendor } from "./vendor";
import {
  expandPassageInPool,
  pickLanguageQuizFromPool,
  resolveQuestionInPool,
} from "./quizPick.shared";

export { MATCH_MAX, bundleMatchQuestion } from "./quizPick.shared";

export function resolveFullQuestion(id: string): Question | undefined {
  return resolveQuestionInPool(id, [...getQuestionMap().values()]);
}

export function expandPassage(question: Question): Question[] {
  return expandPassageInPool(question, filterQuestions({}));
}

export function pickLanguageQuiz(options: {
  vendor: Vendor;
  chapter?: string;
  count: number | "all";
  random: boolean;
  method: LanguagePracticeMode;
  difficulty?: DifficultyFilter;
}): Question[] {
  return pickLanguageQuizFromPool(filterQuestions({}), options);
}

/** 供單元測試／伺服端對照：依難度過濾後的 vendor 池大小。 */
export function countByDifficulty(vendor: Vendor, difficulty?: DifficultyFilter): number {
  return byDifficulty(filterQuestions({ vendor }), difficulty).length;
}

export { pickQuestions };
